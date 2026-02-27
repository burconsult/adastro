document.addEventListener('DOMContentLoaded', () => {
  const inviteBtn = document.getElementById('invite-user-btn');
  const inviteModal = document.getElementById('invite-modal');
  const closeInviteModalBtn = document.getElementById('close-modal');
  const cancelInviteBtn = document.getElementById('cancel-invite');
  const inviteForm = document.getElementById('invite-form');

  const editRoleModal = document.getElementById('edit-role-modal');
  const closeRoleModalBtn = document.getElementById('close-role-modal');
  const cancelRoleBtn = document.getElementById('cancel-role');
  const editRoleForm = document.getElementById('edit-role-form');
  const editRoleUserIdInput = document.getElementById('edit-role-user-id');
  const editRoleUserEmail = document.getElementById('edit-role-user-email');
  const editRoleSelect = document.getElementById('edit-role-select');
  const saveRoleBtn = document.getElementById('save-role-btn');

  const searchInput = document.getElementById('user-search-filter');
  const searchFieldFilter = document.getElementById('user-search-field-filter');
  const roleFilter = document.getElementById('user-role-filter');
  const statusFilter = document.getElementById('user-status-filter');
  const visibleCount = document.getElementById('users-visible-count');
  const noResultsRow = document.getElementById('users-no-results-row');
  const noResultsText = document.getElementById('users-no-results-text');

  const notify = (detail) => {
    const fallbackMessage = detail?.description || detail?.title || 'Something went wrong.';
    if (typeof window.showToast === 'function') {
      window.showToast(detail);
    } else {
      console.error(fallbackMessage);
    }
  };

  const requestConfirm = (options) => {
    if (typeof window.requestConfirm === 'function') {
      return window.requestConfirm(options);
    }
    console.warn('Confirmation dialog unavailable; aborting action.');
    return Promise.resolve(false);
  };

  const getUserRows = () => Array.from(document.querySelectorAll('[data-user-row]'));

  const updateVisibleCount = (count) => {
    if (visibleCount) {
      visibleCount.textContent = `${count} user${count === 1 ? '' : 's'}`;
    }
  };

  const applyFilters = () => {
    const rows = getUserRows();
    if (rows.length === 0) return;

    const searchTerm = searchInput?.value?.trim().toLowerCase() || '';
    const searchField = searchFieldFilter?.value || 'all';
    const selectedRole = roleFilter?.value || '';
    const selectedStatus = statusFilter?.value || '';

    let visibleRows = 0;
    rows.forEach((row) => {
      const email = row.getAttribute('data-email') || '';
      const role = row.getAttribute('data-role') || '';
      const status = row.getAttribute('data-status') || '';

      const haystackByField = {
        email,
        role,
        status,
      };
      const combinedHaystack = `${email} ${role} ${status}`;
      const searchTarget =
        searchField === 'all'
          ? combinedHaystack
          : haystackByField[searchField] || combinedHaystack;

      const matchesSearch = !searchTerm || searchTarget.includes(searchTerm);
      const matchesRole = !selectedRole || role === selectedRole;
      const matchesStatus = !selectedStatus || status === selectedStatus;
      const isVisible = matchesSearch && matchesRole && matchesStatus;

      row.classList.toggle('hidden', !isVisible);
      if (isVisible) {
        visibleRows += 1;
      }
    });

    if (noResultsRow) {
      noResultsRow.classList.toggle('hidden', visibleRows !== 0);
    }
    if (noResultsText && visibleRows === 0) {
      const details = [];
      if (searchTerm) {
        details.push(`search "${searchTerm}" in ${searchField === 'all' ? 'all columns' : searchField}`);
      }
      if (selectedRole) details.push(`role "${selectedRole}"`);
      if (selectedStatus) details.push(`status "${selectedStatus}"`);
      noResultsText.textContent = details.length
        ? `No users found for ${details.join(', ')}.`
        : 'No users match the current filters.';
    }

    updateVisibleCount(visibleRows);
  };

  const showModal = (element) => {
    element?.classList.remove('hidden');
    element?.classList.add('flex');
    element?.setAttribute('aria-hidden', 'false');
  };

  const hideModal = (element) => {
    element?.classList.add('hidden');
    element?.classList.remove('flex');
    element?.setAttribute('aria-hidden', 'true');
  };

  const showInviteModal = () => {
    showModal(inviteModal);
  };

  const hideInviteModal = () => {
    hideModal(inviteModal);
    inviteForm?.reset();
  };

  const showEditRoleModal = ({ userId, email, role }) => {
    if (editRoleUserIdInput) editRoleUserIdInput.value = userId;
    if (editRoleUserEmail) editRoleUserEmail.textContent = email;
    if (editRoleSelect) editRoleSelect.value = role;
    showModal(editRoleModal);
  };

  const hideEditRoleModal = () => {
    hideModal(editRoleModal);
    editRoleForm?.reset();
  };

  inviteBtn?.addEventListener('click', showInviteModal);
  closeInviteModalBtn?.addEventListener('click', hideInviteModal);
  cancelInviteBtn?.addEventListener('click', hideInviteModal);

  closeRoleModalBtn?.addEventListener('click', hideEditRoleModal);
  cancelRoleBtn?.addEventListener('click', hideEditRoleModal);

  searchInput?.addEventListener('input', applyFilters);
  searchFieldFilter?.addEventListener('change', applyFilters);
  roleFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);

  inviteModal?.addEventListener('click', (event) => {
    if (event.target === inviteModal) hideInviteModal();
  });

  editRoleModal?.addEventListener('click', (event) => {
    if (event.target === editRoleModal) hideEditRoleModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideInviteModal();
      hideEditRoleModal();
    }
  });

  inviteForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(inviteForm);
    const email = formData.get('email');
    const role = formData.get('role');

    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
      });

      const result = await response.json();

      if (response.ok) {
        notify({
          variant: 'success',
          title: 'Invitation sent',
          description: `${email} has been invited as ${role}.`,
        });
        hideInviteModal();
        window.location.reload();
      } else {
        notify({
          variant: 'destructive',
          title: 'Invitation failed',
          description: result.error || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Invite error:', error);
      notify({
        variant: 'destructive',
        title: 'Invitation error',
        description: 'An error occurred while sending the invitation.',
      });
    }
  });

  editRoleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const userId = editRoleUserIdInput?.value;
    const role = editRoleSelect?.value;
    const email = editRoleUserEmail?.textContent || 'user';

    if (!userId || !role) return;

    try {
      if (saveRoleBtn) {
        saveRoleBtn.disabled = true;
        saveRoleBtn.textContent = 'Saving...';
      }

      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update role');
      }

      notify({
        variant: 'success',
        title: 'Role updated',
        description: `${email} is now ${role}.`,
      });
      hideEditRoleModal();
      window.location.reload();
    } catch (error) {
      console.error('Update role error:', error);
      notify({
        variant: 'destructive',
        title: 'Role update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      if (saveRoleBtn) {
        saveRoleBtn.disabled = false;
        saveRoleBtn.textContent = 'Save Role';
      }
    }
  });

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const actionEl = target?.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    const userId = actionEl.getAttribute('data-user-id');

    if (!userId) return;

    if (action === 'edit-user') {
      const email = actionEl.getAttribute('data-user-email') || 'Unknown user';
      const role = actionEl.getAttribute('data-user-role') || 'reader';
      showEditRoleModal({ userId, email, role });
      return;
    }

    if (action === 'delete-user') {
      const email = actionEl.getAttribute('data-user-email') || '';
      const confirmed = await requestConfirm({
        title: 'Delete user',
        description: `Are you sure you want to delete ${email}? This action cannot be undone.`,
        confirmLabel: 'Delete user',
        cancelLabel: 'Cancel',
        tone: 'destructive',
      });

      if (!confirmed) return;

      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok) {
          notify({
            variant: 'success',
            title: 'User deleted',
            description: `${email} has been removed.`,
          });

          const row = getUserRows().find((item) => item.getAttribute('data-user-id') === userId);
          row?.remove();
          applyFilters();
        } else {
          notify({
            variant: 'destructive',
            title: 'Delete failed',
            description: result.error || 'Please try again.',
          });
        }
      } catch (error) {
        console.error('Delete user error:', error);
        notify({
          variant: 'destructive',
          title: 'Delete error',
          description: 'An error occurred while deleting the user.',
        });
      }
    }
  });

  applyFilters();
});
