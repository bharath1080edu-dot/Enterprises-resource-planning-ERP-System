// Central Role-Based Access Control (RBAC) configuration
// Based on the permission matrix:
//
// Feature              | Admin           | Manager         | Employee
// Dashboard (KPIs)     | Full Access     | Full Access     | No Access
// Inventory            | Add/Edit/Delete | View/Edit       | View Only
// Production           | View All        | Update Stages   | Update Stages
// Orders               | Full Access     | View/Manage     | No Access
// Payments             | Full Access     | View/Manage     | No Access
// Employee & Payroll   | Full Access     | No Access       | No Access
// Reports (PDF/Excel)  | Generate        | View Only       | No Access
// Attendance           | Full Access     | Full Access     | View Only

export const PERMISSIONS = {
  // Dashboard
  dashboard: {
    view: ['Admin', 'Manager'],
  },
  // Inventory
  inventory: {
    view: ['Admin', 'Manager', 'Employee'],
    add: ['Admin', 'Manager'],
    edit: ['Admin', 'Manager'],
    delete: ['Admin'],
  },
  // Production
  production: {
    view: ['Admin', 'Manager', 'Employee'],
    updateStages: ['Admin', 'Manager', 'Employee'],
  },
  // Orders
  orders: {
    view: ['Admin', 'Manager', 'Employee'],
    add: ['Admin'],
    edit: ['Admin', 'Manager'],
    delete: ['Admin'],
  },
  // Payments
  payments: {
    view: ['Admin', 'Manager'],
    add: ['Admin'],
    delete: ['Admin'],
  },
  // Employees & Payroll
  employees: {
    view: ['Admin'],
    add: ['Admin'],
    edit: ['Admin'],
    delete: ['Admin'],
  },
  // Reports
  reports: {
    view: ['Admin', 'Manager'],
    generate: ['Admin', 'Manager'],
  },
  // Attendance
  attendance: {
    view: ['Admin', 'Manager', 'Employee'],
    add: ['Admin', 'Manager'],
    edit: ['Admin', 'Manager'],
    delete: ['Admin'],
  },
};

/**
 * Check if a role has permission for a specific action on a feature.
 * @param {string} role - The user's role ('Admin', 'Manager', 'Employee')
 * @param {string} feature - Feature key from PERMISSIONS
 * @param {string} action - Action key (view, add, edit, delete, etc.)
 * @returns {boolean}
 */
export const can = (role, feature, action) => {
  if (!role || !feature || !action) return false;
  const featurePerms = PERMISSIONS[feature];
  if (!featurePerms) return false;
  const allowed = featurePerms[action];
  if (!allowed) return false;
  return allowed.includes(role);
};

/**
 * Returns nav items visible to the given role.
 * Routes the user cannot view are removed from the sidebar.
 */
export const VISIBLE_ROUTES = {
  Admin: ['/dashboard', '/inventory', '/orders', '/production', '/employees', '/attendance', '/payments', '/reports', '/notifications', '/whatsapp'],
  Manager: ['/dashboard', '/inventory', '/orders', '/production', '/attendance', '/payments', '/reports', '/notifications'],
  Employee: ['/inventory', '/orders', '/production', '/attendance', '/notifications'],
};

