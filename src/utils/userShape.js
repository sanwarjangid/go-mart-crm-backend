export const shapeUser = (user) => {
  if (!user) {
    return null;
  }

  const { role, user_branches, password, ...rest } = user;
  const permissions = (role?.role_permissions || []).map((row) => row.permission.permission_key);

  return {
    ...rest,
    role: role
      ? {
          id: role.id,
          name: role.name,
          description: role.description,
          is_active: role.is_active,
        }
      : null,
    branches: (user_branches || []).map((row) => row.branch),
    permissions,
    branch_ids: (user_branches || []).map((row) => Number(row.branch_id)),
  };
};

export const shapeRole = (role) => {
  if (!role) {
    return null;
  }

  const { role_permissions, ...rest } = role;
  return {
    ...rest,
    permissions: (role_permissions || []).map((row) => row.permission),
  };
};
