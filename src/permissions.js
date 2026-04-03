export const RESOURCES = {
  SETUP_PROGRAM_MIX: 'setup_program_mix',
  SETUP_TASK_DEFAULTS: 'setup_task_defaults',
  SETUP_ROLE_CONFIG: 'setup_role_config',
  SETUP_CATEGORIES: 'setup_categories',
  SETUP_SKILLS: 'setup_skills',
  SETUP_STAFF: 'setup_staff',
  SETUP_TASK_ORDER: 'setup_task_order',
  MASTER_TEMPLATES: 'master_templates',
  USER_TEMPLATES: 'user_templates',
  DAILY_SCHEDULES: 'daily_schedules',
  PUBLISHED_SCHEDULES: 'published_schedules',
  USERS: 'users',
  ROLES: 'roles',
  ACCESS_CONTROL: 'access_control',
};

export const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  PUBLISH: 'publish',
  ASSIGN: 'assign',
};

export function permissionKey(resource, action) {
  return `${resource}:${action}`;
}

export function canViewAnySetup(can) {
  return (
    can(RESOURCES.SETUP_PROGRAM_MIX, ACTIONS.VIEW) ||
    can(RESOURCES.SETUP_TASK_DEFAULTS, ACTIONS.VIEW) ||
    can(RESOURCES.SETUP_ROLE_CONFIG, ACTIONS.VIEW) ||
    can(RESOURCES.SETUP_CATEGORIES, ACTIONS.VIEW) ||
    can(RESOURCES.SETUP_SKILLS, ACTIONS.VIEW) ||
    can(RESOURCES.SETUP_STAFF, ACTIONS.VIEW) ||
    can(RESOURCES.SETUP_TASK_ORDER, ACTIONS.VIEW)
  );
}
