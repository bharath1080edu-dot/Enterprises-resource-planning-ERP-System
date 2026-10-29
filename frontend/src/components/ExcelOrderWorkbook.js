import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Table, Plus, Trash2, Copy, FileSpreadsheet, Download, Upload,
  Printer, Maximize2, Minimize2, Search, Sparkles, ChevronRight,
  ChevronLeft, Eye, Check, RefreshCw, X, HelpCircle, Layers, Filter,
  Info, CheckCircle2, ArrowRight, Zap, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import XLSX_STYLE from 'xlsx-js-style';
import {
  autoFitWorksheetColumns,
  createCompanyHeaderRows,
  applyCorporateStylesToSheet,
  EXCEL_STYLES,
  EXCEL_PALETTE
} from '../utils/exportUtils';
import {
  calculateAreaSqFt,
  calculateAreaSqFtPrecise,
  calculateOuterFrameMeters,
  calculateCutDimensions,
  calculateCategoryPivot,
  normalizeWorkbookItem,
  smartParseAndSegregateExcel,
  parseFormattedNumber,
  parseTapeFraction,
  formatTapeFraction,
  convertFromMm,
  convertToMm,
  formatDimensionWithUnit,
  MM_PER_INCH,
  MM_PER_FOOT,
  COMMON_CATEGORIES,
  COLOR_OPTIONS,
  GLASS_OPTIONS,
} from '../utils/upvcFormulas';

const XLSX = XLSX_STYLE?.default || XLSX_STYLE;

const ExcelOrderWorkbook = ({
  items = [],
  onChange,
  onAutoUpdateAmount,
  ratePerSqFt = '',
  orderInfo = {},
  readOnly = false,
}) => {
  // Active Sheet tab: 'pivot' | 'master' | 'category-[categoryName]'
  const [activeSheet, setActiveSheet] = useState('pivot');
  const [workbookItems, setWorkbookItems] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddSheetModal, setShowAddSheetModal] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [customCategories, setCustomCategories] = useState([]);
  const [segregationNotice, setSegregationNotice] = useState(null);
  const [activeCellInfo, setActiveCellInfo] = useState({ coord: 'A1', val: 'Ready. Select or click any cell to inspect.' });

  // Measurement unit: 'mm' (default) | 'in' (inches) | 'ft' (feet)
  const [displayUnit, setDisplayUnit] = useState('mm');

  // Glass specification manager (default '5mm')
  const [glassOptions, setGlassOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('upvc_factory_glass_specs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return GLASS_OPTIONS;
  });
  const [selectedBulkGlass, setSelectedBulkGlass] = useState('5mm');
  const [showGlassModal, setShowGlassModal] = useState(false);
  const [newGlassSpecInput, setNewGlassSpecInput] = useState('');

  // Color specification manager (default 'White (Standard)')
  const [colorOptions, setColorOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('upvc_factory_color_specs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return COLOR_OPTIONS;
  });
  const [showColorModal, setShowColorModal] = useState(false);
  const [newColorSpecInput, setNewColorSpecInput] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { id, field, text }

  const tabsScrollRef = useRef(null);

  // Sync initial items from parent
  useEffect(() => {
    if (Array.isArray(items)) {
      const normalized = items.map((it, idx) =>
        normalizeWorkbookItem(it, it.category || it['Product Type'] || 'Fixed Glass', idx + 1)
      );
      setWorkbookItems(normalized);
    }
  }, [items]);

  // Dynamic active category sheets: strictly categories that have at least 1 item,
  // PLUS any custom category the user actively created in this session (e.g. to start adding items).
  // Empty sheets are automatically excluded.
  const activeCategories = useMemo(() => {
    const cats = new Set();
    workbookItems.forEach(it => {
      if (it.category && it.category.trim()) {
        cats.add(it.category.trim());
      }
    });
    // Include custom category sheets explicitly added by user
    customCategories.forEach(c => {
      if (c && c.trim()) cats.add(c.trim());
    });
    return Array.from(cats);
  }, [workbookItems, customCategories]);

  // Live Pivot Calculation based on active displayUnit
  const pivotData = useMemo(() => {
    return calculateCategoryPivot(workbookItems, displayUnit);
  }, [workbookItems, displayUnit]);

  // Synchronize with parent callback whenever items change
  const notifyParent = useCallback((updated) => {
    setWorkbookItems(updated);
    if (onChange) {
      onChange(updated);
    }
    // Calculate total area and suggest amount
    const totalSqFt = updated.reduce((sum, it) => sum + (parseFloat(it.area_sqft) || 0), 0);
    const rate = parseFloat(ratePerSqFt) || 0;
    if (rate > 0 && onAutoUpdateAmount) {
      onAutoUpdateAmount((totalSqFt * rate).toFixed(2));
    }
  }, [onChange, ratePerSqFt, onAutoUpdateAmount]);

  // Save glass specs to localStorage
  const saveGlassSpecs = (newSpecs) => {
    setGlassOptions(newSpecs);
    try {
      localStorage.setItem('upvc_factory_glass_specs', JSON.stringify(newSpecs));
    } catch (e) {}
  };

  // Add new glass specification to dropdown
  const handleAddGlassSpec = (specName) => {
    const name = (specName || newGlassSpecInput).trim();
    if (!name) {
      toast.error('Please enter a glass specification');
      return null;
    }
    if (glassOptions.includes(name)) {
      toast.error('Specification already exists in dropdown');
      return name;
    }
    const updated = [...glassOptions, name];
    saveGlassSpecs(updated);
    setNewGlassSpecInput('');
    toast.success(`Added "${name}" to glass dropdown`);
    return name;
  };

  // Delete a glass specification from dropdown
  const handleDeleteGlassSpec = (specName) => {
    if (glassOptions.length <= 1) {
      toast.error('Cannot delete the last remaining glass specification');
      return;
    }
    const updated = glassOptions.filter(g => g !== specName);
    saveGlassSpecs(updated);
    if (selectedBulkGlass === specName) {
      setSelectedBulkGlass(updated[0]);
    }
    toast.success(`Removed "${specName}" from glass list`);
  };

  // 1-Click: Change glass specification across ALL items on ALL sheets!
  const handleApplyGlassToAll = (specName) => {
    const target = specName || selectedBulkGlass || '5mm';
    if (!workbookItems.length) {
      toast.error('No items in workbook to update');
      return;
    }
    const updated = workbookItems.map(it => ({
      ...it,
      glass_type: target,
      'Glass Type': target,
    }));
    notifyParent(updated);
    toast.success(`⚡ Changed glass to "${target}" for all ${updated.length} items on all sheets!`, { duration: 4000 });
  };

  // Save color specs to localStorage
  const saveColorSpecs = (newSpecs) => {
    setColorOptions(newSpecs);
    try {
      localStorage.setItem('upvc_factory_color_specs', JSON.stringify(newSpecs));
    } catch (e) {}
  };

  // Add new color specification to dropdown
  const handleAddColorSpec = (colorName) => {
    const name = (colorName || newColorSpecInput).trim();
    if (!name) {
      toast.error('Please enter a color / finish name');
      return null;
    }
    if (colorOptions.includes(name)) {
      toast.error('Color option already exists in dropdown');
      return name;
    }
    const updated = [...colorOptions, name];
    saveColorSpecs(updated);
    setNewColorSpecInput('');
    toast.success(`Added "${name}" to colors`);
    return name;
  };

  // Delete a color specification from dropdown
  const handleDeleteColorSpec = (colorName) => {
    if (colorOptions.length <= 1) {
      toast.error('Cannot delete the last remaining color option');
      return;
    }
    const updated = colorOptions.filter(c => c !== colorName);
    saveColorSpecs(updated);
    toast.success(`Removed "${colorName}" from colors`);
  };

  // 1-Click: Change color across ALL items on ALL sheets!
  const handleApplyColorToAll = (colorName) => {
    const target = colorName || 'White (Standard)';
    if (!workbookItems.length) {
      toast.error('No items in workbook to update');
      return;
    }
    const updated = workbookItems.map(it => ({
      ...it,
      color: target,
      'Color / Finish': target,
    }));
    notifyParent(updated);
    toast.success(`⚡ Changed color to "${target}" for all ${updated.length} items on all sheets!`, { duration: 4000 });
  };

  // Dimension cell change with automatic unit conversion into base mm
  const handleDimensionCellChange = (itemId, field, rawInput) => {
    let valMm = '';
    if (rawInput !== '' && rawInput !== null && rawInput !== undefined) {
      const str = String(rawInput).trim();
      // If user typed a tape fraction (e.g. "31 1/8", "41 1/4", "1.5/8"),
      // fractions are ALWAYS in inches! Convert to mm immediately.
      if (str.includes('/')) {
        const inches = parseTapeFraction(str);
        valMm = Math.round(inches * MM_PER_INCH * 10) / 10;
        if (displayUnit === 'mm') {
          setDisplayUnit('in');
          toast.success('Auto-detected tape fraction! Switched to Inches.');
        }
      } else if (displayUnit === 'in') {
        const inches = parseTapeFraction(str);
        valMm = Math.round(inches * MM_PER_INCH * 10) / 10;
      } else if (displayUnit === 'ft') {
        const ft = parseTapeFraction(str);
        valMm = Math.round(ft * MM_PER_FOOT * 10) / 10;
      } else {
        valMm = parseTapeFraction(str);
      }
    }
    handleCellChange(itemId, field, valMm);
  };

  // Update a single item cell
  const handleCellChange = (itemId, field, value) => {
    const updated = workbookItems.map(it => {
      if (it.id !== itemId) return it;

      const copy = { ...it, [field]: value };
      const w = field === 'width_mm' ? parseFormattedNumber(value) : parseFormattedNumber(copy.width_mm);
      const h = field === 'height_mm' ? parseFormattedNumber(value) : parseFormattedNumber(copy.height_mm);
      const cat = field === 'category' ? value : copy.category;
      const glass = field === 'glass_type' ? value : copy.glass_type;
      const col = field === 'color' ? value : copy.color;

      const area = calculateAreaSqFt(w, h);
      const precise = calculateAreaSqFtPrecise(w, h);
      const cuts = calculateCutDimensions(cat, w, h);

      return {
        ...copy,
        area_sqft: area || '',
        area_sqft_precise: precise || '',
        cut_w: cuts.cutW || '',
        cut_h: cuts.cutH || '',
        cut_glass_w: cuts.cutGlassW || '',
        cut_glass_h: cuts.cutGlassH || '',
        // Backward compatibility
        'Product Type': cat,
        'Width (ft)': w > 0 ? (w / 304.8).toFixed(2) : '',
        'Height (ft)': h > 0 ? (h / 304.8).toFixed(2) : '',
        'Sq.Ft': area ? area.toFixed(2) : '',
        'Glass Type': glass,
        'Color / Finish': col,
      };
    });

    notifyParent(updated);
  };

  // Add Row(s)
  const handleAddRows = (count = 1, categoryForSheet = null) => {
    const targetCat = categoryForSheet || (activeSheet.startsWith('category-') ? activeSheet.replace('category-', '') : activeCategories[0] || 'Fixed Glass');
    const newItems = [];
    const currentLen = workbookItems.length;

    for (let i = 0; i < count; i++) {
      const it = normalizeWorkbookItem({}, targetCat, currentLen + i + 1);
      it.glass_type = selectedBulkGlass || '5mm';
      it['Glass Type'] = selectedBulkGlass || '5mm';
      newItems.push(it);
    }

    const updated = [...workbookItems, ...newItems];
    notifyParent(updated);
    toast.success(`Added ${count} row${count > 1 ? 's' : ''} to ${targetCat}`);
  };

  // Delete Row - if deleting this item empties the category, automatically remove the empty sheet!
  const handleDeleteRow = (itemId) => {
    const itemToDelete = workbookItems.find(it => it.id === itemId);
    const updated = workbookItems
      .filter(it => it.id !== itemId)
      .map((it, idx) => ({ ...it, sNo: idx + 1 }));
    notifyParent(updated);
    toast.success('Row deleted');

    if (itemToDelete && itemToDelete.category) {
      const remainingInCat = updated.filter(it => it.category === itemToDelete.category);
      if (remainingInCat.length === 0) {
        setCustomCategories(prev => prev.filter(c => c !== itemToDelete.category));
        if (activeSheet === `category-${itemToDelete.category}`) {
          setActiveSheet('pivot');
          toast(`Removed empty sheet: "${itemToDelete.category}"`, { icon: '🗑️' });
        }
      }
    }
  };

  // Explicitly remove a sheet (removes empty sheet or all its rows)
  const handleRemoveSheet = (categoryName) => {
    const remainingItems = workbookItems
      .filter(it => it.category !== categoryName)
      .map((it, idx) => ({ ...it, sNo: idx + 1 }));
    setCustomCategories(prev => prev.filter(c => c !== categoryName));
    if (remainingItems.length !== workbookItems.length) {
      notifyParent(remainingItems);
    }
    if (activeSheet === `category-${categoryName}`) {
      setActiveSheet('pivot');
    }
    toast.success(`Removed sheet "${categoryName}"`);
  };

  // Clean all empty sheets
  const handleCleanEmptySheets = () => {
    const catsWithItems = new Set(workbookItems.map(it => it.category).filter(Boolean));
    const emptyCategories = customCategories.filter(c => !catsWithItems.has(c));
    if (emptyCategories.length === 0) {
      toast('No empty sheets found', { icon: 'ℹ️' });
      return;
    }
    setCustomCategories(prev => prev.filter(c => catsWithItems.has(c)));
    if (activeSheet.startsWith('category-') && !catsWithItems.has(activeSheet.replace('category-', ''))) {
      setActiveSheet('pivot');
    }
    toast.success(`Cleaned ${emptyCategories.length} empty sheet(s)`);
  };

  // Duplicate Row
  const handleDuplicateRow = (item) => {
    const dup = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sNo: workbookItems.length + 1,
    };
    notifyParent([...workbookItems, dup]);
    toast.success('Row duplicated');
  };

  // Add a new dynamic single-product sheet
  const handleCreateSheet = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const name = newSheetName.trim();
    if (!name) {
      toast.error('Please enter a product category name');
      return;
    }
    if (!customCategories.includes(name)) {
      setCustomCategories(prev => [...prev, name]);
    }
    setNewSheetName('');
    setShowAddSheetModal(false);
    setActiveSheet(`category-${name}`);
    toast.success(`Created sheet: ${name}`);
  };

  // Scroll Sheet Tab Bar horizontally
  const handleScrollTabs = (direction) => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollBy({ left: direction * 180, behavior: 'smooth' });
    }
  };

  // Smart Parser & Segregator for Pasted TSV Text
  const handlePasteData = (rawText, targetCategory = null) => {
    if (!rawText || !rawText.trim()) return;

    const lines = rawText.trim().split(/\r?\n/).map(l => l.split('\t').map(c => c.trim()));
    if (lines.length === 0) return;

    const defaultCat = targetCategory || (activeSheet.startsWith('category-') ? activeSheet.replace('category-', '') : activeCategories[0] || 'Fixed Glass');
    const { items: newParsedItems, detectedCategories, categoryCounts } = smartParseAndSegregateExcel(
      lines,
      defaultCat,
      workbookItems.length
    );

    if (newParsedItems.length === 0) {
      toast.error('No valid measurement numbers found in pasted text.');
      return;
    }

    // Add any newly detected product categories into active sheet list
    if (detectedCategories.length > 0) {
      setCustomCategories(prev => {
        const set = new Set([...prev, ...detectedCategories]);
        return Array.from(set);
      });
    }

    const updated = [...workbookItems, ...newParsedItems];
    notifyParent(updated);
    setShowPasteModal(false);
    setPasteRawText('');

    // Setup segregation notice
    setSegregationNotice({
      count: newParsedItems.length,
      categories: detectedCategories,
      categoryCounts,
    });

    // Auto-switch to Pivot Dashboard so user immediately sees the segregated breakdown
    setActiveSheet('pivot');

    toast.success(
      `🎉 Segregated ${newParsedItems.length} items into ${detectedCategories.length} product sheets!`,
      { duration: 5000 }
    );
  };

  // Smart Parser & Segregator for Uploaded XLSX Files
  const handleImportXLSX = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Search for Master Database or read first sheet
        let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('master')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonMatrix || jsonMatrix.length === 0) {
          toast.error('Spreadsheet is empty or lacks rows');
          return;
        }

        // Smart parse and segregate
        const defaultCat = activeCategories[0] || 'Fixed Glass';
        const { items: importedItems, detectedCategories, categoryCounts } = smartParseAndSegregateExcel(
          jsonMatrix,
          defaultCat,
          0
        );

        if (importedItems.length === 0) {
          toast.error('Could not extract measurement rows from this Excel file.');
          return;
        }

        // Register any new categories
        if (detectedCategories.length > 0) {
          setCustomCategories(prev => {
            const set = new Set([...prev, ...detectedCategories]);
            return Array.from(set);
          });
        }

        notifyParent(importedItems);

        setSegregationNotice({
          count: importedItems.length,
          categories: detectedCategories,
          categoryCounts,
        });

        setActiveSheet('pivot');
        toast.success(
          `✅ Imported & segregated ${importedItems.length} items into ${detectedCategories.length} product sheets!`,
          { duration: 6000 }
        );
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Native window paste event listener on the active sheet table
  const handleTableKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      navigator.clipboard?.readText()?.then(text => {
        if (text && (text.includes('\t') || text.includes('\n'))) {
          handlePasteData(text);
        }
      }).catch(() => {
        setShowPasteModal(true);
      });
    }
  };

  // Export Multi-Sheet XLSX with Professional Company Details & Formatted Grid
  const handleExportXLSX = () => {
    try {
      const wb = XLSX.utils.book_new();
      const orderIdStr = orderInfo.id ? `#${orderInfo.id}` : 'Draft';
      const custStr = orderInfo.customer_name || 'Customer';
      const metaStr = `Order ${orderIdStr}   |   Customer: ${custStr}   |   Generated: ${new Date().toLocaleString('en-IN')}`;

      // ── Sheet 1: Category Pivot Dashboard ───────────────────────
      const pivotHeaders = [
        '#',
        'UPVC Product Category',
        'Line Item Count',
        'Total Area (Sq.Ft)',
        'Outer Frame Length (m)',
        'Footprint Share (%)',
        'Typical Sizing (W x H mm)'
      ];
      const pivotHeaderMeta = createCompanyHeaderRows(
        pivotHeaders.length,
        'UPVC CATEGORY PROFILE & AREA BREAKDOWN',
        metaStr
      );

      const pivotDataRows = pivotData.rows.map((r, i) => [
        i + 1,
        r.category,
        Number(r.lineItemCount) || 0,
        Number(r.totalAreaSqFt) || 0,
        Number(r.outerFramesMeters) || 0,
        `${r.percentFootprint}%`,
        r.avgSizingLabel || '—'
      ]);

      const pivotTotalRow = [
        'TOTAL',
        pivotData.totalSummary.category || 'All Categories',
        Number(pivotData.totalSummary.lineItemCount) || 0,
        Number(pivotData.totalSummary.totalAreaSqFt) || 0,
        Number(pivotData.totalSummary.outerFramesMeters) || 0,
        '100.0%',
        pivotData.totalSummary.avgSizingLabel || '—'
      ];

      const pivotDisclaimerRow = [
        '* Factory profile & footprint breakdown generated by Image Creator UPVC Factory ERP. Confidential.',
        ...Array(pivotHeaders.length - 1).fill('')
      ];

      const allPivotRows = [
        ...pivotHeaderMeta.rows,
        pivotHeaders,
        ...pivotDataRows,
        pivotTotalRow,
        Array(pivotHeaders.length).fill(''),
        pivotDisclaimerRow
      ];

      const pivotDisclaimerIdx = allPivotRows.length - 1;
      const wsPivot = XLSX.utils.aoa_to_sheet(allPivotRows);
      wsPivot['!merges'] = [
        ...pivotHeaderMeta.merges,
        { s: { r: pivotDisclaimerIdx, c: 0 }, e: { r: pivotDisclaimerIdx, c: pivotHeaders.length - 1 } }
      ];
      wsPivot['!rows'] = [
        ...pivotHeaderMeta.rowHeights,
        { hpt: 24 }, // Header
        ...pivotDataRows.map(() => ({ hpt: 20 })),
        { hpt: 22 }, // Total
        { hpt: 10 },
        { hpt: 18 }  // Disclaimer
      ];
      // Apply minimal corporate styling to Pivot sheet
      applyCorporateStylesToSheet(wsPivot, {
        colCount: pivotHeaders.length,
        tableHeaderRow: pivotHeaderMeta.rows.length,
        dataRowCount: pivotDataRows.length,
        totalRowIndex: pivotHeaderMeta.rows.length + 1 + pivotDataRows.length,
        disclaimerRowIndex: pivotDisclaimerIdx,
        alignments: ['center', 'left', 'right', 'right', 'right', 'center', 'center']
      });

      autoFitWorksheetColumns(wsPivot, pivotHeaderMeta.rows.length, {
        0: 6,
        1: 28,
        2: 18,
        3: 20,
        4: 24,
        5: 22,
        6: 26
      });
      XLSX.utils.book_append_sheet(wb, wsPivot, 'Pivot Dashboard');

      // ── Sheet 2: Master Measurement Database ────────────────────
      const masterHeaders = [
        'S.No',
        'Width (mm)',
        'Height (mm)',
        'UPVC Category',
        'Area (Sq.Ft)',
        'Profile Color',
        'Glass Specification',
        'Frame Cut W (mm)',
        'Frame Cut H (mm)',
        'Glass Cut W (mm)',
        'Glass Cut H (mm)',
        'Fabrication Notes'
      ];
      const masterHeaderMeta = createCompanyHeaderRows(
        masterHeaders.length,
        'MASTER MEASUREMENT & CUTTING DATABASE',
        `${metaStr}   |   Total Production Units: ${workbookItems.length}`
      );

      const masterDataRows = workbookItems.map((it, idx) => [
        idx + 1,
        Number(it.width_mm) || (it.width_mm || ''),
        Number(it.height_mm) || (it.height_mm || ''),
        it.category || 'Fixed Glass',
        Number(it.area_sqft) || (it.area_sqft || ''),
        it.color || 'White',
        it.glass_type || '5mm Clear',
        Number(it.cut_w) || (it.cut_w || ''),
        Number(it.cut_h) || (it.cut_h || ''),
        Number(it.cut_glass_w) || (it.cut_glass_w || ''),
        Number(it.cut_glass_h) || (it.cut_glass_h || ''),
        it.notes || ''
      ]);

      const totalArea = workbookItems.reduce((s, it) => s + (parseFloat(it.area_sqft) || 0), 0);
      const masterTotalRow = [
        'TOTAL',
        '',
        '',
        `${workbookItems.length} Total Units`,
        Number(totalArea.toFixed(2)),
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ];

      const masterDisclaimerRow = [
        '* Detailed dimensions and tolerance cuts generated by Image Creator UPVC Factory ERP. Verify on site before final fabrication.',
        ...Array(masterHeaders.length - 1).fill('')
      ];

      const allMasterRows = [
        ...masterHeaderMeta.rows,
        masterHeaders,
        ...masterDataRows,
        masterTotalRow,
        Array(masterHeaders.length).fill(''),
        masterDisclaimerRow
      ];

      const masterDisclaimerIdx = allMasterRows.length - 1;
      const wsMaster = XLSX.utils.aoa_to_sheet(allMasterRows);
      wsMaster['!merges'] = [
        ...masterHeaderMeta.merges,
        { s: { r: masterDisclaimerIdx, c: 0 }, e: { r: masterDisclaimerIdx, c: masterHeaders.length - 1 } }
      ];
      wsMaster['!rows'] = [
        ...masterHeaderMeta.rowHeights,
        { hpt: 24 }, // Header
        ...masterDataRows.map(() => ({ hpt: 20 })),
        { hpt: 22 }, // Total
        { hpt: 10 },
        { hpt: 18 }  // Disclaimer
      ];

      // Apply minimal corporate styling to Master sheet
      const masterAlignments = ['center', 'right', 'right', 'left', 'right', 'center', 'left', 'right', 'right', 'right', 'right', 'left'];
      applyCorporateStylesToSheet(wsMaster, {
        colCount: masterHeaders.length,
        tableHeaderRow: masterHeaderMeta.rows.length,
        dataRowCount: masterDataRows.length,
        totalRowIndex: masterHeaderMeta.rows.length + 1 + masterDataRows.length,
        disclaimerRowIndex: masterDisclaimerIdx,
        alignments: masterAlignments
      });

      // Highlight Frame Cut and Glass Cut columns with minimal corporate tints
      for (let i = 0; i < masterDataRows.length; i++) {
        const r = masterHeaderMeta.rows.length + 1 + i;
        const frameWAddr = XLSX.utils.encode_cell({ r, c: 7 });
        const frameHAddr = XLSX.utils.encode_cell({ r, c: 8 });
        const glassWAddr = XLSX.utils.encode_cell({ r, c: 9 });
        const glassHAddr = XLSX.utils.encode_cell({ r, c: 10 });
        if (wsMaster[frameWAddr]) wsMaster[frameWAddr].s = EXCEL_STYLES.frameCutCell('right');
        if (wsMaster[frameHAddr]) wsMaster[frameHAddr].s = EXCEL_STYLES.frameCutCell('right');
        if (wsMaster[glassWAddr]) wsMaster[glassWAddr].s = EXCEL_STYLES.glassCutCell('right');
        if (wsMaster[glassHAddr]) wsMaster[glassHAddr].s = EXCEL_STYLES.glassCutCell('right');
      }

      autoFitWorksheetColumns(wsMaster, masterHeaderMeta.rows.length, {
        0: 6,
        1: 14,
        2: 14,
        3: 24,
        4: 16,
        5: 16,
        6: 22,
        7: 18,
        8: 18,
        9: 18,
        10: 18,
        11: 30
      });
      XLSX.utils.book_append_sheet(wb, wsMaster, 'Master Database');

      // ── Sheet 3..N: Product Specific Category Sheets ────────────
      activeCategories.forEach(cat => {
        const catItems = workbookItems.filter(it => it.category === cat);
        const catHeaders = [
          'S.No',
          'Width (mm)',
          'Height (mm)',
          'Category',
          'Area (Sq.Ft)',
          'Color',
          'Glass Type',
          'Frame Cut W (mm)',
          'Frame Cut H (mm)',
          'Glass Cut W (mm)',
          'Glass Cut H (mm)',
          'Notes'
        ];
        const catHeaderMeta = createCompanyHeaderRows(
          catHeaders.length,
          `CATEGORY CUTTING LIST: ${cat.toUpperCase()}`,
          `${metaStr}   |   Units in this Category: ${catItems.length}`
        );

        const catDataRows = catItems.map((it, idx) => [
          idx + 1,
          Number(it.width_mm) || (it.width_mm || ''),
          Number(it.height_mm) || (it.height_mm || ''),
          it.category || cat,
          Number(it.area_sqft) || (it.area_sqft || ''),
          it.color || 'White',
          it.glass_type || '5mm Clear',
          Number(it.cut_w) || (it.cut_w || ''),
          Number(it.cut_h) || (it.cut_h || ''),
          Number(it.cut_glass_w) || (it.cut_glass_w || ''),
          Number(it.cut_glass_h) || (it.cut_glass_h || ''),
          it.notes || ''
        ]);

        const catArea = catItems.reduce((s, it) => s + (parseFloat(it.area_sqft) || 0), 0);
        const catTotalRow = [
          'TOTAL',
          '',
          '',
          `${catItems.length} Units`,
          Number(catArea.toFixed(2)),
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ];

        const allCatRows = [
          ...catHeaderMeta.rows,
          catHeaders,
          ...catDataRows,
          catTotalRow,
          Array(catHeaders.length).fill(''),
          [
            `* Specific cut tolerance for ${cat} generated by Image Creator UPVC Factory ERP.`,
            ...Array(catHeaders.length - 1).fill('')
          ]
        ];

        const catDisclaimerIdx = allCatRows.length - 1;
        const wsCat = XLSX.utils.aoa_to_sheet(allCatRows);
        wsCat['!merges'] = [
          ...catHeaderMeta.merges,
          { s: { r: catDisclaimerIdx, c: 0 }, e: { r: catDisclaimerIdx, c: catHeaders.length - 1 } }
        ];
        wsCat['!rows'] = [
          ...catHeaderMeta.rowHeights,
          { hpt: 24 },
          ...catDataRows.map(() => ({ hpt: 20 })),
          { hpt: 22 },
          { hpt: 10 },
          { hpt: 18 }
        ];

        // Apply minimal corporate styling to Category Cut sheet
        const catAlignments = ['center', 'right', 'right', 'left', 'right', 'center', 'left', 'right', 'right', 'right', 'right', 'left'];
        applyCorporateStylesToSheet(wsCat, {
          colCount: catHeaders.length,
          tableHeaderRow: catHeaderMeta.rows.length,
          dataRowCount: catDataRows.length,
          totalRowIndex: catHeaderMeta.rows.length + 1 + catDataRows.length,
          disclaimerRowIndex: catDisclaimerIdx,
          alignments: catAlignments
        });

        // Highlight Frame Cut and Glass Cut columns with minimal corporate tints
        for (let i = 0; i < catDataRows.length; i++) {
          const r = catHeaderMeta.rows.length + 1 + i;
          const frameWAddr = XLSX.utils.encode_cell({ r, c: 7 });
          const frameHAddr = XLSX.utils.encode_cell({ r, c: 8 });
          const glassWAddr = XLSX.utils.encode_cell({ r, c: 9 });
          const glassHAddr = XLSX.utils.encode_cell({ r, c: 10 });
          if (wsCat[frameWAddr]) wsCat[frameWAddr].s = EXCEL_STYLES.frameCutCell('right');
          if (wsCat[frameHAddr]) wsCat[frameHAddr].s = EXCEL_STYLES.frameCutCell('right');
          if (wsCat[glassWAddr]) wsCat[glassWAddr].s = EXCEL_STYLES.glassCutCell('right');
          if (wsCat[glassHAddr]) wsCat[glassHAddr].s = EXCEL_STYLES.glassCutCell('right');
        }

        autoFitWorksheetColumns(wsCat, catHeaderMeta.rows.length, {
          0: 6,
          1: 14,
          2: 14,
          3: 20,
          4: 16,
          5: 16,
          6: 20,
          7: 18,
          8: 18,
          9: 18,
          10: 18,
          11: 26
        });

        const safeSheetName = cat.substring(0, 30).replace(/[:\\/?*[\]]/g, '_');
        XLSX.utils.book_append_sheet(wb, wsCat, safeSheetName);
      });

      const fileName = `Order_Measurement_Workbook_${orderInfo.id || 'Draft'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Workbook exported: ${fileName}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel workbook');
    }
  };

  // Print Cut Sheet for Category
  const handlePrintCategory = (catName) => {
    const catItems = workbookItems.filter(it => it.category === catName);
    const totalSqFt = catItems.reduce((s, it) => s + (parseFloat(it.area_sqft) || 0), 0);

    const printWin = window.open('', '_blank');
    if (!printWin) return toast.error('Pop-up blocked. Please allow pop-ups to print.');

    const rowsHtml = catItems.map((it, i) => `
      <tr>
        <td style="text-align:center;font-weight:bold">${i + 1}</td>
        <td style="text-align:center;font-weight:bold">${it.width_mm || '—'}</td>
        <td style="text-align:center;font-weight:bold">${it.height_mm || '—'}</td>
        <td>${it.category}</td>
        <td style="text-align:center">${it.area_sqft || '—'}</td>
        <td>${it.color || '—'}</td>
        <td>${it.glass_type || '—'}</td>
        <td style="text-align:center;font-weight:bold;color:#1B3A6B">${it.cut_w || '—'}</td>
        <td style="text-align:center;font-weight:bold;color:#1B3A6B">${it.cut_h || '—'}</td>
        <td style="text-align:center">${it.cut_glass_w || '—'}</td>
        <td style="text-align:center">${it.cut_glass_h || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cut Sheet - ${catName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 12px; color: #1e293b; }
          .header { border-bottom: 2px solid #1B2A4A; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          h1 { margin: 0; font-size: 18px; color: #1B2A4A; }
          .meta { font-size: 12px; color: #64748b; }
          .kpi { display: flex; gap: 16px; margin-bottom: 16px; font-size: 12px; }
          .kpi-chip { background: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #1B2A4A; color: #fff; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
          td { border-bottom: 1px solid #e2e8f0; padding: 6px; }
          tr:nth-child(even) { background: #f8fafc; }
          @media print { body { padding: 0; } @page { margin: 10mm; size: landscape; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>FACTORY PRODUCTION CUT SHEET</h1>
            <div class="meta">Category: <strong>${catName}</strong> | Order #${orderInfo.id || 'N/A'} — ${orderInfo.customer_name || 'Customer'}</div>
          </div>
          <div class="meta">Date: ${new Date().toLocaleDateString('en-IN')}</div>
        </div>
        <div class="kpi">
          <div class="kpi-chip">Total Units: ${catItems.length}</div>
          <div class="kpi-chip">Total Area: ${totalSqFt.toFixed(2)} Sq.Ft</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Width (mm)</th>
              <th>Height (mm)</th>
              <th>Category</th>
              <th>Area (Sq.Ft)</th>
              <th>Color</th>
              <th>Glass Spec</th>
              <th>Cut W (mm)</th>
              <th>Cut H (mm)</th>
              <th>Glass W (mm)</th>
              <th>Glass H (mm)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
  };

  // Filtered Items for current view
  const currentSheetCategory = activeSheet.startsWith('category-')
    ? activeSheet.replace('category-', '')
    : null;

  const displayedItems = useMemo(() => {
    let list = workbookItems;
    if (currentSheetCategory) {
      list = list.filter(it => it.category === currentSheetCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(it =>
        (it.category || '').toLowerCase().includes(q) ||
        (it.color || '').toLowerCase().includes(q) ||
        (it.glass_type || '').toLowerCase().includes(q) ||
        String(it.width_mm).includes(q) ||
        String(it.height_mm).includes(q) ||
        String(it.sNo).includes(q)
      );
    }
    return list;
  }, [workbookItems, currentSheetCategory, searchQuery]);

  return (
    <div
      onKeyDown={handleTableKeyDown}
      tabIndex={0}
      className={`flex flex-col bg-slate-100 border border-slate-300 rounded-2xl shadow-md overflow-hidden transition-all duration-300 focus:outline-none ${
        isFullscreen
          ? 'fixed inset-3 z-50 bg-slate-100 shadow-2xl ring-4 ring-navy-900/30'
          : 'relative min-h-[600px] max-h-[820px]'
      }`}
    >
      {/* ── Top Ribbon Action & Toolbar ────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F2243] via-[#1B3A6B] to-[#1E293B] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-blue-950">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white shadow-xs">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-wide text-white">
                uPVC Factory Measurement Sheets
              </h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-mono font-bold">
                Auto-Segregator Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Pivot Dashboard &bull; Master Database &bull; Dynamic Product Sheets
            </p>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2">
          {/* Global Unit Switcher */}
          <div className="flex items-center gap-1.5 bg-navy-950/80 px-2 py-1 rounded-lg border border-navy-700 text-xs">
            <span className="text-slate-300 text-[11px] font-semibold">Unit:</span>
            <select
              value={displayUnit}
              onChange={e => {
                const u = e.target.value;
                setDisplayUnit(u);
                toast.success(`Converted measurements to ${u === 'mm' ? 'Millimeters (mm)' : u === 'in' ? 'Inches (Tape Fractions: 31 1/8, 41 1/4)' : 'Feet (ft)'} across all sheets!`);
              }}
              className="bg-navy-900 text-orange-400 font-bold text-xs px-1.5 py-0.5 rounded border border-navy-700 focus:outline-none cursor-pointer"
            >
              <option value="mm">mm</option>
              <option value="in">Inches (Tape - 1/8")</option>
              <option value="ft">Feet (ft)</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-navy-950/70 text-white text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-navy-700 focus:border-orange-400 focus:outline-none w-32 sm:w-40 placeholder:text-slate-400"
            />
          </div>

          {!readOnly && (
            <>
              {/* Paste helper */}
              <button
                type="button"
                onClick={() => setShowPasteModal(true)}
                className="btn-xs bg-navy-800 hover:bg-navy-700 text-white border border-navy-600 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                title="Paste data copied from Microsoft Excel (Ctrl+V)"
              >
                <Copy size={13} />
                <span className="hidden sm:inline">Paste</span>
              </button>

              {/* Import Excel */}
              <label
                className="btn-xs bg-navy-800 hover:bg-navy-700 text-white border border-navy-600 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                title="Upload .xlsx file with single or multiple products"
              >
                <Upload size={13} />
                <span className="hidden sm:inline">Import</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportXLSX}
                  className="hidden"
                />
              </label>
            </>
          )}

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportXLSX}
            className="btn-xs bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-600 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
            title="Download multi-sheet Excel file"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(p => !p)}
            className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ── Excel Formula & Cell Coordinate Bar ────────────────────── */}
      <div className="bg-slate-50 border-b border-slate-300 px-3 py-1 flex items-center gap-2 text-xs font-mono select-none">
        <div className="flex items-center justify-center font-bold text-slate-700 bg-white border border-slate-300 px-2 py-0.5 rounded min-w-[42px] text-center shadow-2xs">
          {activeCellInfo.coord}
        </div>
        <span className="font-bold text-slate-400 italic px-1 font-serif text-sm">fx</span>
        <div className="flex-1 bg-white border border-slate-300 px-2.5 py-0.5 rounded truncate text-slate-800 font-sans text-xs">
          {activeCellInfo.val}
        </div>
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-sans">
          <span>Active Product: <strong className="text-navy-900">{currentSheetCategory || 'All Products (Master)'}</strong></span>
        </div>
      </div>

      {/* ── Segregation Notification Banner ────────────────────────── */}
      {segregationNotice && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-900 flex items-center justify-between animate-slide-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>
              <strong>Auto-Segregation Completed:</strong> Successfully separated{' '}
              <strong>{segregationNotice.count}</strong> items into{' '}
              <strong>{segregationNotice.categories.length} dedicated product sheets</strong>:{' '}
              {segregationNotice.categories.map(cat => `${cat} (${segregationNotice.categoryCounts[cat] || 0})`).join(' • ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSheet('pivot')}
              className="text-[11px] font-bold text-emerald-800 bg-emerald-200/60 hover:bg-emerald-200 px-2.5 py-0.5 rounded-lg transition-all"
            >
              View Pivot &rarr;
            </button>
            <button
              type="button"
              onClick={() => setSegregationNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Sheet Canvas ──────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-slate-50/50 p-3">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VIEW 1: CATEGORY PIVOT DASHBOARD (Matching Image 1)         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeSheet === 'pivot' && (
          <div className="space-y-3 animate-fade-in">
            {/* Sheet Title Bar with Unit Dropdown on the RIGHT SIDE */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <h1 className="text-lg font-black text-navy-950 flex items-center gap-2">
                  <span className="text-orange-500 font-extrabold">e -</span> Category Pivot Dashboard
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live production category breakdown, line item count, area footprint &amp; frame metrics
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* KPI Pill Summary */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-mono text-xs">
                  <span className="text-slate-500 font-sans">Total Items:</span>
                  <strong className="text-navy-900 font-black">{pivotData.totalSummary.lineItemCount}</strong>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 font-sans">Total Area:</span>
                  <strong className="text-orange-600 font-black">{pivotData.totalSummary.totalAreaSqFt.toLocaleString('en-IN')} Sq.Ft</strong>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 font-sans">Outer Frames:</span>
                  <strong className="text-blue-700 font-black">{pivotData.totalSummary.outerFramesMeters.toFixed(2)} m</strong>
                </div>

                {/* Measurement Unit Dropdown on RIGHT SIDE of Category Pivot Dashboard */}
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-3 py-1.5 rounded-xl shadow-2xs">
                  <label htmlFor="pivot-unit-selector" className="text-xs font-bold text-navy-900 flex items-center gap-1 whitespace-nowrap">
                    <span>📐</span> Unit:
                  </label>
                  <select
                    id="pivot-unit-selector"
                    value={displayUnit}
                    onChange={e => {
                      const u = e.target.value;
                      setDisplayUnit(u);
                      toast.success(`Converted measurements to ${u === 'mm' ? 'Millimeters (mm)' : u === 'in' ? 'Inches (Tape Fractions: 31 1/8, 41 1/4)' : 'Feet (ft)'} across all sheets!`);
                    }}
                    className="bg-white text-blue-900 font-black text-xs px-2.5 py-1 rounded-lg border border-blue-300 focus:border-blue-600 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    <option value="mm">Millimeters (mm)</option>
                    <option value="in">Inches (Tape Fraction - 1/8", 1/4")</option>
                    <option value="ft">Feet (ft)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pivot Table with Freeze-Header Scrolling */}
            <div className="relative overflow-auto max-h-[500px] rounded-xl border border-slate-300 shadow-sm bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <table className="w-full text-xs text-left border-collapse min-w-[760px]">
                <thead className="sticky top-0 z-20 bg-[#1B3A6B] text-white shadow-xs">
                  <tr className="font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-4 border-r border-blue-900">Item Category</th>
                    <th className="py-2.5 px-4 text-center border-r border-blue-900 w-28">Line Item Count</th>
                    <th className="py-2.5 px-4 text-right border-r border-blue-900 w-36">Total Area (Sq.Ft)</th>
                    <th className="py-2.5 px-4 text-center border-r border-blue-900 w-28">
                      <div>Outter</div>
                      <div className="text-[10px] font-normal text-blue-200">Frames (m)</div>
                    </th>
                    <th className="py-2.5 px-4 text-center border-r border-blue-900 w-44">% of Total Footprint</th>
                    <th className="py-2.5 px-4 border-r border-blue-900">Avg Sizing (W x H {displayUnit})</th>
                    <th className="py-2.5 px-3 text-center w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
                  {pivotData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        No measurements recorded yet. Click on the{' '}
                        <strong className="text-navy-900">Master Database</strong> or a{' '}
                        <strong className="text-navy-900">Category Sheet</strong> below to add site items.
                      </td>
                    </tr>
                  ) : (
                    pivotData.rows.map((row, idx) => (
                      <tr
                        key={row.category}
                        onClick={() => setActiveSheet(`category-${row.category}`)}
                        className={`cursor-pointer transition-colors hover:bg-blue-50/70 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-bold text-navy-900 border-r border-slate-200">
                          <div className="flex items-center justify-between">
                            <span>{row.category}</span>
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-normal">
                              View Sheet &rarr;
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-navy-800 border-r border-slate-200">
                          {row.lineItemCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.totalAreaSqFt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-700 border-r border-slate-200">
                          {row.outerFramesMeters.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="w-12 text-right font-mono font-bold text-slate-700">
                              {row.percentFootprint.toFixed(1)}%
                            </span>
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, Math.max(0, row.percentFootprint))}%` }}
                                className={`h-full rounded-full ${
                                  row.percentFootprint > 50
                                    ? 'bg-blue-600'
                                    : row.percentFootprint > 15
                                    ? 'bg-orange-500'
                                    : 'bg-emerald-500'
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-700 border-r border-slate-200">
                          {row.avgSizingLabel}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSheet(`category-${row.category}`);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                            title={`Open dedicated sheet for ${row.category}`}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Total Summary Footer Row (Matching Image 1) */}
                  {pivotData.rows.length > 0 && (
                    <tr className="bg-slate-100 font-black text-navy-950 border-t-2 border-navy-900 sticky bottom-0 z-10 shadow-xs">
                      <td className="py-3 px-4 font-black uppercase text-xs border-r border-slate-300">
                        {pivotData.totalSummary.category}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-sm border-r border-slate-300">
                        {pivotData.totalSummary.lineItemCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-orange-600 border-r border-slate-300">
                        {pivotData.totalSummary.totalAreaSqFt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-sm border-r border-slate-300">
                        {pivotData.totalSummary.outerFramesMeters.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-sm border-r border-slate-300">
                        100.0%
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-slate-600 font-mono text-xs">
                        {pivotData.totalSummary.avgSizingLabel}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pivot Tips Card */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info size={15} className="text-blue-600 flex-shrink-0" />
                <span>
                  <strong>Tip:</strong> Click any category row above or select a sheet tab below to view &amp; print cut sheets for that single product!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSheetModal(true)}
                className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-300 hover:bg-blue-50 shadow-2xs"
              >
                + Add Product Category
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VIEW 2: MASTER MEASUREMENT DATABASE (Matching Image 4)      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeSheet === 'master' && (
          <div className="space-y-3 animate-fade-in">
            {/* Sheet Title Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <h1 className="text-lg font-black text-navy-950 flex items-center gap-2">
                  Master Measurement Database
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidated master ledger of all site measurements &amp; auto-calculated cut sizes
                </p>
              </div>

              {/* Master Actions */}
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddRows(1)}
                    className="btn-accent text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Plus size={13} /> +1 Row
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddRows(5)}
                    className="btn-secondary text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Plus size={13} /> +5 Rows
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddRows(10)}
                    className="btn-secondary text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Plus size={13} /> +10 Rows
                  </button>
                </div>
              )}
            </div>

            {/* Master Spreadsheet Table */}
            {renderSpreadsheetGrid(displayedItems, false)}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VIEW 3..N: DEDICATED SINGLE-PRODUCT SHEETS (Images 2 & 3)   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {currentSheetCategory && (
          <div className="space-y-3 animate-fade-in">
            {/* Sheet Title Bar matching user reference format */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <h1 className="text-base sm:text-lg font-black text-navy-950 flex items-center gap-2">
                  Details for Count of Width ({displayUnit}) - Category:{' '}
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 font-bold">
                    {currentSheetCategory}
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Workstation cut schedule dedicated exclusively to single product: <strong>{currentSheetCategory}</strong>
                </p>
              </div>

              {/* Category KPIs & Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintCategory(currentSheetCategory)}
                  className="bg-navy-800 hover:bg-navy-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
                  title="Print cut list for workshop line"
                >
                  <Printer size={13} /> Print Cut Sheet
                </button>

                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAddRows(1, currentSheetCategory)}
                      className="btn-accent text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={13} /> Add Line
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddRows(5, currentSheetCategory)}
                      className="btn-secondary text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={13} /> +5 Lines
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Empty Sheet Banner with Direct Remove Button */}
            {displayedItems.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
                <div className="flex items-center gap-2 text-amber-900 font-medium">
                  <Info size={16} className="text-amber-600 shrink-0" />
                  <span>This sheet is currently empty (0 items). You can add rows or remove this sheet.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddRows(1, currentSheetCategory)}
                    className="btn-accent text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs font-bold"
                  >
                    <Plus size={12} /> Add Line
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSheet(currentSheetCategory)}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs font-bold transition-colors"
                  >
                    <Trash2 size={12} /> Remove Empty Sheet
                  </button>
                </div>
              </div>
            )}

            {/* Single Product Spreadsheet Table */}
            {renderSpreadsheetGrid(displayedItems, true, currentSheetCategory)}
          </div>
        )}
      </div>

      {/* ── Excel Status Bar (Matching real Excel bottom status bar) ─ */}
      <div className="bg-slate-100 border-t border-slate-300 px-3 py-1 flex items-center justify-between text-[11px] font-mono text-slate-600 select-none">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.2 rounded text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> READY
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="hidden sm:inline">Active Sheet: <strong>{currentSheetCategory || (activeSheet === 'pivot' ? 'Pivot Dashboard' : 'Master Database')}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span>Rows: <strong>{displayedItems.length}</strong></span>
          <span>|</span>
          <span>Sum Area: <strong>{displayedItems.reduce((s, it) => s + (parseFloat(it.area_sqft) || 0), 0).toFixed(2)} Sq.Ft</strong></span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">
            Avg W: <strong>{displayedItems.length > 0 ? (displayUnit === 'mm' ? Math.round(displayedItems.reduce((s, it) => s + (parseFloat(it.width_mm) || 0), 0) / displayedItems.length) : convertFromMm(displayedItems.reduce((s, it) => s + (parseFloat(it.width_mm) || 0), 0) / displayedItems.length, displayUnit)) : 0} {displayUnit}</strong>
          </span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">
            Avg H: <strong>{displayedItems.length > 0 ? (displayUnit === 'mm' ? Math.round(displayedItems.reduce((s, it) => s + (parseFloat(it.height_mm) || 0), 0) / displayedItems.length) : convertFromMm(displayedItems.reduce((s, it) => s + (parseFloat(it.height_mm) || 0), 0) / displayedItems.length, displayUnit)) : 0} {displayUnit}</strong>
          </span>
        </div>
      </div>

      {/* ── Bottom Excel Sheet Tab Bar (Excel-authentic navigation) ── */}
      <div className="bg-slate-200 border-t border-slate-300 px-2 py-1.5 flex items-center justify-between gap-1 select-none">
        {/* Left / Right Sheet Tab Scroller Arrows */}
        <div className="flex items-center gap-0.5 pr-1 border-r border-slate-300">
          <button
            type="button"
            onClick={() => handleScrollTabs(-1)}
            className="p-1 rounded hover:bg-slate-300 text-slate-600 hover:text-navy-900 transition-colors"
            title="Scroll sheet tabs left"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleScrollTabs(1)}
            className="p-1 rounded hover:bg-slate-300 text-slate-600 hover:text-navy-900 transition-colors"
            title="Scroll sheet tabs right"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Scrollable Sheet Tabs */}
        <div
          ref={tabsScrollRef}
          className="flex items-center gap-1 flex-1 overflow-x-auto py-0.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
        >
          {/* Tab 1: Pivot Dashboard */}
          <button
            type="button"
            onClick={() => setActiveSheet('pivot')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 ${
              activeSheet === 'pivot'
                ? 'bg-white text-[#1B3A6B] border-blue-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-300/80 border-transparent'
            }`}
          >
            <span>📊</span>
            <span>Category Pivot Dashboard</span>
          </button>

          {/* Tab 2: Master Database */}
          <button
            type="button"
            onClick={() => setActiveSheet('master')}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 ${
              activeSheet === 'master'
                ? 'bg-white text-navy-950 border-orange-500 shadow-sm'
                : 'text-slate-600 hover:bg-slate-300/80 border-transparent'
            }`}
          >
            <span>🗄️</span>
            <span>Master Measurement Database</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
              {workbookItems.length}
            </span>
          </button>

          {/* Tab 3..N: Dedicated Single-Product Sheets with Close / Remove [x] */}
          {activeCategories.map(cat => {
            const isCatActive = activeSheet === `category-${cat}`;
            const count = workbookItems.filter(it => it.category === cat).length;

            return (
              <div
                key={cat}
                onClick={() => setActiveSheet(`category-${cat}`)}
                className={`group px-3 py-1.5 rounded-t-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                  isCatActive
                    ? 'bg-white text-blue-900 border-blue-600 font-bold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-300/80 border-transparent'
                }`}
              >
                <span>📋</span>
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isCatActive ? 'bg-blue-100 text-blue-800 font-bold' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSheet(cat);
                    }}
                    className={`p-0.5 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors ${
                      count === 0 ? 'inline-block text-red-500' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    title={count === 0 ? `Remove empty sheet "${cat}"` : `Close sheet "${cat}"`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Product Sheet Tab */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddSheetModal(true)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-orange-600 hover:bg-orange-100/60 font-bold flex items-center gap-1 whitespace-nowrap transition-all border border-dashed border-orange-300 ml-1"
              title="Add a new single-product category sheet"
            >
              <Plus size={13} />
              <span>Add Product Sheet</span>
            </button>
          )}

          {/* Clean Empty Sheets Button */}
          {!readOnly && customCategories.some(c => !workbookItems.some(it => it.category === c)) && (
            <button
              type="button"
              onClick={handleCleanEmptySheets}
              className="px-2 py-1 rounded-lg text-[11px] text-slate-500 hover:text-red-600 hover:bg-red-50 flex items-center gap-1 transition-all ml-1"
              title="Remove all empty sheets"
            >
              <Trash2 size={11} />
              <span>Clean Empty Sheets</span>
            </button>
          )}
        </div>

        {/* Total Grand Count summary badge on bottom right */}
        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-300 text-[11px] text-slate-600 font-mono whitespace-nowrap">
          <span>Total: <strong>{workbookItems.length}</strong> items</span>
          <span>&bull;</span>
          <span><strong>{pivotData.totalSummary.totalAreaSqFt.toFixed(2)}</strong> Sq.Ft</span>
        </div>
      </div>

      {/* ── Modal: Add Single-Product Sheet ────────────────────────── */}
      {showAddSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-scale-up border border-slate-200">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <h3 className="text-sm font-black text-navy-900 uppercase tracking-wide">
                  Add Single-Product Sheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSheetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSheet} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Product Category Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fixed Glass, 2.5 track sliding, ST Fixed Profiles..."
                  value={newSheetName}
                  onChange={e => setNewSheetName(e.target.value)}
                  className="input text-xs w-full font-semibold h-9"
                  autoFocus
                  required
                />
              </div>

              {/* Quick-pick presets */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Quick Presets
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-50 rounded-lg border border-slate-200">
                  {COMMON_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewSheetName(cat)}
                      className={`text-[11px] px-2 py-1 rounded-md border text-left transition-all ${
                        newSheetName === cat
                          ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSheetModal(false)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent text-xs px-4 py-1.5 font-bold shadow-sm"
                >
                  Create Product Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Direct Excel Paste Helper ──────────────────────── */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-scale-up border border-slate-200">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={18} />
                <h3 className="text-sm font-black text-navy-900 uppercase tracking-wide">
                  Paste Data from Microsoft Excel / Google Sheets
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Copy any flat table from your Excel sheet (single product or mixed products) and paste below. The system will <strong>automatically detect each product</strong>, segregate into distinct product sheets, and generate the Pivot Dashboard!
            </p>

            <textarea
              rows={8}
              value={pasteRawText}
              onChange={e => setPasteRawText(e.target.value)}
              placeholder="Paste cells here...&#10;1	582	563	Fixed Glass&#10;5	1,505	1,109	ST Fixed Profiles&#10;7	1,511	1,459	2.5 track sliding"
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 focus:border-orange-400 focus:outline-none bg-slate-50"
              autoFocus
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400">
                Default Sheet:{' '}
                <strong>
                  {currentSheetCategory || 'Auto-Segregate All Categories'}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handlePasteData(pasteRawText, currentSheetCategory)}
                  className="btn-accent text-xs px-4 py-1.5 font-bold shadow-sm"
                >
                  Import &amp; Segregate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Manage Glass Specifications ────────────────────── */}
      {showGlassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-scale-up border border-slate-200">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-black text-navy-900 uppercase tracking-wide">
                  Manage Glass Specifications
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGlassModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Add New Specification Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddGlassSpec();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="e.g. 5mm, 8mm Acoustic, 6mm Tinted..."
                value={newGlassSpecInput}
                onChange={e => setNewGlassSpecInput(e.target.value)}
                className="input text-xs flex-1 font-semibold h-9"
                autoFocus
              />
              <button
                type="submit"
                className="btn-accent text-xs px-3 py-1.5 font-bold shadow-xs flex items-center gap-1 shrink-0"
              >
                <Plus size={13} /> Add
              </button>
            </form>

            {/* List of Specifications with Delete & 1-Click Apply */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Active Specifications ({glassOptions.length}) &bull; Default: <strong>5mm</strong>
              </span>
              {glassOptions.map(spec => (
                <div
                  key={spec}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${spec === '5mm' ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-blue-400'}`} />
                    <span className="text-xs font-semibold text-navy-900">
                      {spec} {spec === '5mm' && <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded ml-1">Default</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyGlassToAll(spec);
                        setShowGlassModal(false);
                      }}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-blue-200 transition-colors"
                      title={`Apply "${spec}" to all rows on all sheets`}
                    >
                      <Zap size={11} /> 1-Click All
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteGlassSpec(spec)}
                      disabled={glassOptions.length <= 1}
                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 disabled:opacity-30 transition-colors"
                      title={`Delete specification "${spec}"`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Click <strong>1-Click All</strong> to update all items in the workbook.</span>
              <button
                type="button"
                onClick={() => setShowGlassModal(false)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Manage Color Options ─────────────────────────── */}
      {showColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-scale-up border border-slate-200">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-sm font-black text-navy-900 uppercase tracking-wide">
                  Manage Color / Finish Options
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowColorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Add New Color Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddColorSpec();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="e.g. Teakwood, Anthracite Metallic, Jet Black..."
                value={newColorSpecInput}
                onChange={e => setNewColorSpecInput(e.target.value)}
                className="input text-xs flex-1 font-semibold h-9"
                autoFocus
              />
              <button
                type="submit"
                className="btn-accent text-xs px-3 py-1.5 font-bold shadow-xs flex items-center gap-1 shrink-0"
              >
                <Plus size={13} /> Add
              </button>
            </form>

            {/* List of Colors with Delete & 1-Click Apply */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Active Colors ({colorOptions.length}) &bull; Default: <strong>White (Standard)</strong>
              </span>
              {colorOptions.map(col => (
                <div
                  key={col}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full border border-slate-300 shadow-2xs ${
                      col.toLowerCase().includes('white') ? 'bg-white' :
                      col.toLowerCase().includes('black') ? 'bg-zinc-900' :
                      col.toLowerCase().includes('grey') || col.toLowerCase().includes('anthracite') ? 'bg-slate-600' :
                      col.toLowerCase().includes('oak') || col.toLowerCase().includes('teak') || col.toLowerCase().includes('walnut') ? 'bg-amber-800' :
                      'bg-indigo-600'
                    }`} />
                    <span className="text-xs font-semibold text-navy-900">
                      {col} {col.toLowerCase().includes('white') && <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded ml-1">Standard</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleApplyColorToAll(col);
                        setShowColorModal(false);
                      }}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-amber-200 transition-colors"
                      title={`Apply "${col}" to all rows on all sheets`}
                    >
                      <Zap size={11} className="fill-amber-500" /> 1-Click All
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteColorSpec(col)}
                      disabled={colorOptions.length <= 1}
                      className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 disabled:opacity-30 transition-colors"
                      title={`Delete color "${col}"`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Click <strong>1-Click All</strong> to update all items in the workbook.</span>
              <button
                type="button"
                onClick={() => setShowColorModal(false)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // Helper: Renders the spreadsheet grid with Frozen Column & Sticky Headers
  // ─────────────────────────────────────────────────────────────
  function renderSpreadsheetGrid(gridItems, isSingleProductSheet = false, lockedCategory = '') {
    const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    if (!readOnly) colLetters.push('L');

    // Dimension display formatter in active unit
    const getDisplayDim = (valMm) => {
      if (valMm === '' || valMm === null || valMm === undefined) return '';
      const num = parseFormattedNumber(valMm);
      if (num <= 0) return '';
      if (displayUnit === 'mm') return num;
      return convertFromMm(num, displayUnit);
    };

    return (
      <div className="relative overflow-auto max-h-[520px] rounded-xl border border-slate-300 shadow-sm bg-white scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
          {/* Sticky Excel Header Group */}
          <thead className="sticky top-0 z-30 shadow-xs">
            {/* Row 1: Excel Column Letters A, B, C, D... */}
            <tr className="bg-[#0F2243] text-slate-300 text-[9px] font-mono border-b border-blue-950 select-none">
              <th className="py-0.5 px-2 text-center border-r border-blue-950 sticky left-0 z-40 bg-[#0F2243] w-12">
                #
              </th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-24">B</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-24">C</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 min-w-[160px]">D</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-28">E</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-36">F</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-44">G</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-20">H</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-20">I</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-24">J</th>
              <th className="py-0.5 px-2 text-center border-r border-blue-950 w-24">K</th>
              {!readOnly && <th className="py-0.5 px-2 text-center w-16">L</th>}
            </tr>

            {/* Row 2: Standard Production Field Names */}
            <tr className="bg-[#1B3A6B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-blue-900">
              <th className="py-2 px-2 text-center border-r border-blue-900 sticky left-0 z-40 bg-[#1B3A6B] shadow-[2px_0_4px_rgba(0,0,0,0.15)] w-12">
                S.No
              </th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-24">Width ({displayUnit})</th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-24">Height ({displayUnit})</th>
              <th className="py-2 px-3 border-r border-blue-900 min-w-[160px]">Category</th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-28">Area (Sq.Ft)</th>
              <th className="py-2 px-3 border-r border-blue-900 min-w-[150px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Color</span>
                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowColorModal(true)}
                        className="p-1 text-amber-300 hover:text-amber-100 hover:bg-blue-800/80 rounded transition-colors flex items-center gap-0.5 text-[10px] font-bold"
                        title="⚡ 1-Click Change All Colors"
                      >
                        <Zap size={11} className="fill-amber-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowColorModal(true)}
                        className="p-1 text-blue-200 hover:text-white rounded hover:bg-blue-800 transition-colors"
                        title="⚙️ Manage Color Options (Add / Delete)"
                      >
                        <Settings size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </th>
              <th className="py-2 px-3 border-r border-blue-900 min-w-[160px]">
                <div className="flex items-center justify-between gap-1">
                  <span>Glass Spec</span>
                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowGlassModal(true)}
                        className="p-1 text-amber-300 hover:text-amber-100 hover:bg-blue-800/80 rounded transition-colors flex items-center gap-0.5 text-[10px] font-bold"
                        title="⚡ 1-Click Change All Glass"
                      >
                        <Zap size={11} className="fill-amber-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGlassModal(true)}
                        className="p-1 text-blue-200 hover:text-white rounded hover:bg-blue-800 transition-colors"
                        title="⚙️ Manage Glass Specifications (Add / Delete)"
                      >
                        <Settings size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-20">Cut W ({displayUnit})</th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-20">Cut H ({displayUnit})</th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-24">Cut Glass W ({displayUnit})</th>
              <th className="py-2 px-3 text-center border-r border-blue-900 w-24">Cut Glass H ({displayUnit})</th>
              {!readOnly && <th className="py-2 px-2 text-center w-16">Actions</th>}
            </tr>
          </thead>

          {/* Spreadsheet Body */}
          <tbody className="divide-y divide-slate-200 font-sans text-slate-800">
            {gridItems.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 11 : 12} className="py-12 text-center text-slate-400 font-medium">
                  No items in this sheet yet.{' '}
                  {!readOnly && (
                    <span>
                      Click <strong className="text-navy-900">"+ Add Line"</strong> above or press{' '}
                      <strong className="text-navy-900">Ctrl+V</strong> to paste from Excel.
                    </span>
                  )}
                </td>
              </tr>
            ) : (
              gridItems.map((item, rowIdx) => {
                const isEven = rowIdx % 2 === 0;

                return (
                  <tr
                    key={item.id || rowIdx}
                    className={`transition-colors hover:bg-blue-50/60 ${
                      isEven ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    {/* S.No (FROZEN LEFT COLUMN) */}
                    <td className="py-1 px-2 text-center font-mono font-bold text-slate-600 border-r border-slate-300 sticky left-0 z-20 bg-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                      {item.sNo || rowIdx + 1}
                    </td>

                    {/* Width */}
                    <td className="p-0.5 border-r border-slate-200">
                      {readOnly ? (
                        <div
                          className="py-1 px-2 text-center font-mono font-bold"
                          onClick={() => setActiveCellInfo({ coord: `B${rowIdx + 2}`, val: `Width: ${getDisplayDim(item.width_mm)} ${displayUnit}` })}
                        >
                          {getDisplayDim(item.width_mm) || '—'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode={displayUnit === 'mm' ? 'numeric' : 'text'}
                          className="w-full text-center font-mono font-bold text-xs py-1 px-1 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 focus:bg-white focus:outline-none bg-transparent"
                          value={
                            editingCell && editingCell.id === item.id && editingCell.field === 'width_mm'
                              ? editingCell.text
                              : (getDisplayDim(item.width_mm) || '')
                          }
                          onFocus={() => {
                            setActiveCellInfo({ coord: `B${rowIdx + 2}`, val: `Width: ${getDisplayDim(item.width_mm)} ${displayUnit}` });
                            setEditingCell({ id: item.id, field: 'width_mm', text: getDisplayDim(item.width_mm) || '' });
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            setEditingCell({ id: item.id, field: 'width_mm', text: val });
                            handleDimensionCellChange(item.id, 'width_mm', val);
                          }}
                          onBlur={() => setEditingCell(null)}
                          placeholder={displayUnit === 'mm' ? '582' : displayUnit === 'in' ? '31 1/8' : '1.91'}
                        />
                      )}
                    </td>

                    {/* Height */}
                    <td className="p-0.5 border-r border-slate-200">
                      {readOnly ? (
                        <div
                          className="py-1 px-2 text-center font-mono font-bold"
                          onClick={() => setActiveCellInfo({ coord: `C${rowIdx + 2}`, val: `Height: ${getDisplayDim(item.height_mm)} ${displayUnit}` })}
                        >
                          {getDisplayDim(item.height_mm) || '—'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          inputMode={displayUnit === 'mm' ? 'numeric' : 'text'}
                          className="w-full text-center font-mono font-bold text-xs py-1 px-1 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 focus:bg-white focus:outline-none bg-transparent"
                          value={
                            editingCell && editingCell.id === item.id && editingCell.field === 'height_mm'
                              ? editingCell.text
                              : (getDisplayDim(item.height_mm) || '')
                          }
                          onFocus={() => {
                            setActiveCellInfo({ coord: `C${rowIdx + 2}`, val: `Height: ${getDisplayDim(item.height_mm)} ${displayUnit}` });
                            setEditingCell({ id: item.id, field: 'height_mm', text: getDisplayDim(item.height_mm) || '' });
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            setEditingCell({ id: item.id, field: 'height_mm', text: val });
                            handleDimensionCellChange(item.id, 'height_mm', val);
                          }}
                          onBlur={() => setEditingCell(null)}
                          placeholder={displayUnit === 'mm' ? '563' : displayUnit === 'in' ? '41 1/4' : '1.85'}
                        />
                      )}
                    </td>

                    {/* Category */}
                    <td className="p-0.5 border-r border-slate-200 font-semibold text-navy-900">
                      {readOnly || isSingleProductSheet ? (
                        <div
                          className="py-1 px-2 truncate"
                          onClick={() => setActiveCellInfo({ coord: `D${rowIdx + 2}`, val: `Category: ${item.category}` })}
                        >
                          {isSingleProductSheet ? lockedCategory : (item.category || '—')}
                        </div>
                      ) : (
                        <select
                          className="w-full text-xs py-1 px-1 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none bg-transparent cursor-pointer"
                          value={item.category || activeCategories[0] || 'Fixed Glass'}
                          onFocus={() => setActiveCellInfo({ coord: `D${rowIdx + 2}`, val: `Category: ${item.category}` })}
                          onChange={e => handleCellChange(item.id, 'category', e.target.value)}
                        >
                          {activeCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Area (Sq.Ft) */}
                    <td
                      onClick={() => setActiveCellInfo({ coord: `E${rowIdx + 2}`, val: `=(${item.width_mm} × ${item.height_mm}) / 92903.04 = ${item.area_sqft} Sq.Ft` })}
                      className="py-1 px-2 text-center font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-50/40 cursor-default"
                    >
                      {item.area_sqft || (item.width_mm && item.height_mm ? calculateAreaSqFt(item.width_mm, item.height_mm) : '—')}
                    </td>

                    {/* Color with 1-Click All & Custom Color Support */}
                    <td className="p-0.5 border-r border-slate-200">
                      {readOnly ? (
                        <div
                          className="py-1 px-2 truncate text-slate-700"
                          onClick={() => setActiveCellInfo({ coord: `F${rowIdx + 2}`, val: `Color: ${item.color || 'White (Standard)'}` })}
                        >
                          {item.color || 'White (Standard)'}
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <select
                            className="w-full text-xs py-1 px-1 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none bg-transparent cursor-pointer"
                            value={item.color || 'White (Standard)'}
                            onFocus={() => setActiveCellInfo({ coord: `F${rowIdx + 2}`, val: `Color: ${item.color || 'White (Standard)'}` })}
                            onChange={e => {
                              if (e.target.value === '__CUSTOM__') {
                                const custom = window.prompt('Enter custom color / finish name (e.g. Teakwood Lamination, Anthracite Metallic):');
                                if (custom && custom.trim()) {
                                  const added = handleAddColorSpec(custom.trim());
                                  handleCellChange(item.id, 'color', added || custom.trim());
                                }
                              } else if (e.target.value === '__MANAGE__') {
                                setShowColorModal(true);
                              } else {
                                handleCellChange(item.id, 'color', e.target.value);
                              }
                            }}
                          >
                            {colorOptions.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="__CUSTOM__">➕ Add Custom Color...</option>
                            <option value="__MANAGE__">⚙️ Manage Colors...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleApplyColorToAll(item.color || 'White (Standard)')}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors shrink-0"
                            title={`⚡ Apply "${item.color || 'White (Standard)'}" to ALL items on all sheets (1-click)`}
                          >
                            <Zap size={12} className="fill-amber-400" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Glass Type with 1-Click All & Custom Spec Support */}
                    <td className="p-0.5 border-r border-slate-200">
                      {readOnly ? (
                        <div
                          className="py-1 px-2 truncate text-slate-700"
                          onClick={() => setActiveCellInfo({ coord: `G${rowIdx + 2}`, val: `Glass: ${item.glass_type || '5mm'}` })}
                        >
                          {item.glass_type || '5mm'}
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <select
                            className="w-full text-xs py-1 px-1 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none bg-transparent cursor-pointer"
                            value={item.glass_type || '5mm'}
                            onFocus={() => setActiveCellInfo({ coord: `G${rowIdx + 2}`, val: `Glass: ${item.glass_type || '5mm'}` })}
                            onChange={e => {
                              if (e.target.value === '__CUSTOM__') {
                                const custom = window.prompt('Enter custom glass specification (e.g. 8mm Acoustic Toughened):');
                                if (custom && custom.trim()) {
                                  const added = handleAddGlassSpec(custom.trim());
                                  handleCellChange(item.id, 'glass_type', added || custom.trim());
                                }
                              } else if (e.target.value === '__MANAGE__') {
                                setShowGlassModal(true);
                              } else {
                                handleCellChange(item.id, 'glass_type', e.target.value);
                              }
                            }}
                          >
                            {glassOptions.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                            <option value="__CUSTOM__">➕ Add Custom Spec...</option>
                            <option value="__MANAGE__">⚙️ Manage Specs...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleApplyGlassToAll(item.glass_type || '5mm')}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors shrink-0"
                            title={`⚡ Apply "${item.glass_type || '5mm'}" to ALL items on all sheets (1-click)`}
                          >
                            <Zap size={12} className="fill-amber-400" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Cut W */}
                    <td
                      onClick={() => setActiveCellInfo({ coord: `H${rowIdx + 2}`, val: `Sash Cut W: ${getDisplayDim(item.cut_w)} ${displayUnit}` })}
                      className="py-1 px-2 text-center font-mono font-bold text-blue-900 border-r border-slate-200 bg-blue-50/30 cursor-default"
                    >
                      {getDisplayDim(item.cut_w) || '—'}
                    </td>

                    {/* Cut H */}
                    <td
                      onClick={() => setActiveCellInfo({ coord: `I${rowIdx + 2}`, val: `Sash Cut H: ${getDisplayDim(item.cut_h)} ${displayUnit}` })}
                      className="py-1 px-2 text-center font-mono font-bold text-blue-900 border-r border-slate-200 bg-blue-50/30 cursor-default"
                    >
                      {getDisplayDim(item.cut_h) || '—'}
                    </td>

                    {/* Cut Glass W */}
                    <td
                      onClick={() => setActiveCellInfo({ coord: `J${rowIdx + 2}`, val: `Cut Glass W: ${getDisplayDim(item.cut_glass_w)} ${displayUnit}` })}
                      className="py-1 px-2 text-center font-mono text-slate-700 border-r border-slate-200 bg-slate-50/40 cursor-default"
                    >
                      {getDisplayDim(item.cut_glass_w) || '—'}
                    </td>

                    {/* Cut Glass H */}
                    <td
                      onClick={() => setActiveCellInfo({ coord: `K${rowIdx + 2}`, val: `Cut Glass H: ${getDisplayDim(item.cut_glass_h)} ${displayUnit}` })}
                      className="py-1 px-2 text-center font-mono text-slate-700 border-r border-slate-200 bg-slate-50/40 cursor-default"
                    >
                      {getDisplayDim(item.cut_glass_h) || '—'}
                    </td>

                    {/* Actions */}
                    {!readOnly && (
                      <td className="py-1 px-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateRow(item)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Duplicate Row"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  }
};

export default ExcelOrderWorkbook;
