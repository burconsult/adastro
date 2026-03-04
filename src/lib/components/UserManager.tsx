import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2, UserCog, Users } from 'lucide-react';
import { ToastProvider, useToast } from '@/lib/components/ui/toast';
import {
  AdminLoadingState,
  IconActionButton,
  ListingFilterField,
  ListingFiltersCard,
  ListingFiltersGrid,
  ListingStateRow,
  ListingTableCard,
  ListingTableScroller
} from '@/lib/components/admin/ListingPrimitives';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/lib/components/ui/dialog';

type UserRole = 'admin' | 'author' | 'reader';
type UserStatus = 'active' | 'pending';
type AvatarSource = 'custom' | 'gravatar';
type SearchField = 'all' | 'email' | 'name' | 'role' | 'status';

type UserProfile = {
  fullName: string;
  bio: string;
  avatarUrl: string;
  avatarSource: AvatarSource;
};

type UserRecord = {
  id: string;
  email: string;
  role: UserRole;
  authorId: string | null;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  profile: UserProfile;
};

type UsersApiResponse = {
  users: UserRecord[];
  total: number;
};

type EditUserForm = {
  email: string;
  role: UserRole;
  fullName: string;
  bio: string;
  avatarSource: AvatarSource;
  avatarUrl: string;
  emailConfirmed: boolean;
};

const roleBadgeClass = (role: UserRole) =>
  role === 'admin'
    ? 'bg-destructive/10 text-destructive'
    : role === 'author'
      ? 'bg-info/10 text-info'
      : 'bg-muted text-muted-foreground';

const statusBadgeClass = (status: UserStatus) =>
  status === 'active'
    ? 'bg-success/10 text-success'
    : 'bg-warning/10 text-warning-foreground';

const statusForUser = (user: UserRecord): UserStatus => (
  user.emailConfirmed ? 'active' : 'pending'
);

const formatDate = (isoDate: string | null) => {
  if (!isoDate) return 'Never';
  const date = new Date(isoDate);
  if (Number.isNaN(date.valueOf())) return 'Unknown';
  return date.toLocaleDateString();
};

const normalizeRole = (value: string): UserRole => {
  if (value === 'admin' || value === 'author' || value === 'reader') return value;
  return 'reader';
};

const normalizeAvatarSource = (value: string): AvatarSource => {
  if (value === 'custom') return 'custom';
  return 'gravatar';
};

const createEditForm = (user: UserRecord): EditUserForm => ({
  email: user.email,
  role: user.role,
  fullName: user.profile.fullName || '',
  bio: user.profile.bio || '',
  avatarSource: user.profile.avatarSource === 'custom' ? 'custom' : 'gravatar',
  avatarUrl: user.profile.avatarUrl || '',
  emailConfirmed: user.emailConfirmed
});

export default function UserManager() {
  return (
    <ToastProvider>
      <UserManagerInner />
    </ToastProvider>
  );
}

function UserManagerInner() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);

  const [searchField, setSearchField] = useState<SearchField>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('author');
  const [inviteBusy, setInviteBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    email: '',
    role: 'reader',
    fullName: '',
    bio: '',
    avatarSource: 'gravatar',
    avatarUrl: '',
    emailConfirmed: false
  });
  const [editBusy, setEditBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadUsers = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setReloading(true);
    }

    try {
      const response = await fetch('/api/admin/users?perPage=200');
      const payload = await response.json().catch(() => null) as UsersApiResponse | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && typeof payload === 'object' && 'error' in payload && payload.error
          ? payload.error
          : 'Failed to load users');
      }

      const nextUsers = Array.isArray((payload as UsersApiResponse).users)
        ? (payload as UsersApiResponse).users
        : [];
      setUsers(nextUsers.map((user) => ({
        ...user,
        role: normalizeRole(user.role),
        profile: {
          fullName: user.profile?.fullName || '',
          bio: user.profile?.bio || '',
          avatarUrl: user.profile?.avatarUrl || '',
          avatarSource: normalizeAvatarSource(user.profile?.avatarSource || 'gravatar')
        }
      })));
      setTotalUsers(typeof (payload as UsersApiResponse).total === 'number' ? (payload as UsersApiResponse).total : nextUsers.length);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to load users',
        description: error instanceof Error ? error.message : 'Please try again.'
      });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers(true);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const status = statusForUser(user);
      const haystackByField: Record<SearchField, string> = {
        all: '',
        email: user.email.toLowerCase(),
        name: (user.profile.fullName || '').toLowerCase(),
        role: user.role.toLowerCase(),
        status
      };
      const combined = `${haystackByField.email} ${haystackByField.name} ${haystackByField.role} ${haystackByField.status}`.trim();
      const searchTarget = searchField === 'all' ? combined : haystackByField[searchField];

      const matchesSearch = !needle || searchTarget.includes(needle);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchField, searchTerm, statusFilter, users]);

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditForm(createEditForm(user));
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditBusy(false);
    setEditOpen(false);
    setEditingUser(null);
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email is required',
        description: 'Enter a valid email before sending an invitation.'
      });
      return;
    }

    try {
      setInviteBusy(true);
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole
        })
      });

      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to send invitation');
      }

      toast({
        variant: 'success',
        title: 'Invitation sent',
        description: `${inviteEmail.trim()} has been invited as ${inviteRole}.`
      });

      setInviteEmail('');
      setInviteRole('author');
      setInviteOpen(false);
      await loadUsers(false);
    } catch (error) {
      console.error('Invite user error:', error);
      toast({
        variant: 'destructive',
        title: 'Invitation failed',
        description: error instanceof Error ? error.message : 'Please try again.'
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    try {
      setEditBusy(true);
      const payload = {
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        fullName: editForm.fullName.trim(),
        bio: editForm.bio.trim(),
        avatarSource: editForm.avatarSource,
        avatarUrl: editForm.avatarSource === 'custom' ? editForm.avatarUrl.trim() : '',
        emailConfirmed: editForm.emailConfirmed
      };

      const response = await fetch(`/api/admin/users/${encodeURIComponent(editingUser.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responsePayload = await response.json().catch(() => null) as { error?: string; user?: UserRecord } | null;
      if (!response.ok) {
        throw new Error(responsePayload?.error || 'Failed to update user');
      }

      const updatedUser = responsePayload?.user;
      if (updatedUser) {
        setUsers((current) => current.map((user) => (
          user.id === updatedUser.id
            ? {
                ...updatedUser,
                role: normalizeRole(updatedUser.role),
                profile: {
                  fullName: updatedUser.profile?.fullName || '',
                  bio: updatedUser.profile?.bio || '',
                  avatarUrl: updatedUser.profile?.avatarUrl || '',
                  avatarSource: normalizeAvatarSource(updatedUser.profile?.avatarSource || 'gravatar')
                }
              }
            : user
        )));
      } else {
        await loadUsers(false);
      }

      toast({
        variant: 'success',
        title: 'User updated',
        description: `${payload.email} has been updated.`
      });
      closeEdit();
    } catch (error) {
      console.error('Edit user error:', error);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.'
      });
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteBusy(true);
      const response = await fetch(`/api/admin/users/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE'
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete user');
      }

      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      setTotalUsers((current) => Math.max(0, current - 1));
      toast({
        variant: 'success',
        title: 'User deleted',
        description: `${deleteTarget.email} has been removed.`
      });
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete user error:', error);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again.'
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading users..." className="py-12" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'} visible
          <span className="mx-2">•</span>
          {totalUsers} total
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite User
          </button>
          <button type="button" className="btn btn-outline" onClick={() => loadUsers(false)} disabled={reloading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <ListingFiltersCard>
        <ListingFiltersGrid columnsClassName="grid-cols-1 md:grid-cols-[180px_1fr_180px_180px]">
          <ListingFilterField label="Search In" htmlFor="users-search-field">
            <select
              id="users-search-field"
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              value={searchField}
              onChange={(event) => setSearchField(event.target.value as SearchField)}
            >
              <option value="all">All columns</option>
              <option value="email">Email</option>
              <option value="name">Name</option>
              <option value="role">Role</option>
              <option value="status">Status</option>
            </select>
          </ListingFilterField>

          <ListingFilterField label="Search" htmlFor="users-search">
            <input
              id="users-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search users"
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
            />
          </ListingFilterField>

          <ListingFilterField label="Role" htmlFor="users-role-filter">
            <select
              id="users-role-filter"
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as UserRole | '')}
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="author">Author</option>
              <option value="reader">Reader</option>
            </select>
          </ListingFilterField>

          <ListingFilterField label="Status" htmlFor="users-status-filter">
            <select
              id="users-status-filter"
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as UserStatus | '')}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </select>
          </ListingFilterField>
        </ListingFiltersGrid>
      </ListingFiltersCard>

      {users.length === 0 ? (
        <div className="card p-8 text-center text-muted-foreground">
          <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>No users found</p>
        </div>
      ) : (
        <ListingTableCard>
          <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All Users</h2>
            <p className="text-sm text-muted-foreground">{filteredUsers.length} visible</p>
          </div>
          <ListingTableScroller>
            <table className="w-full min-w-full text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 sm:px-6">User</th>
                  <th className="hidden px-4 py-3 md:table-cell">Role</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Status</th>
                  <th className="hidden px-4 py-3 xl:table-cell">Last Sign In</th>
                  <th className="px-4 py-3 text-right sm:px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 bg-card">
                {filteredUsers.map((user) => {
                  const status = statusForUser(user);
                  const joinedDate = formatDate(user.createdAt);
                  const lastSeenDate = formatDate(user.lastSignInAt);

                  return (
                    <tr key={user.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-medium">
                              {(user.email || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{user.email}</p>
                            {user.profile.fullName ? (
                              <p className="truncate text-xs text-muted-foreground">{user.profile.fullName}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">Joined {joinedDate}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:hidden">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass(user.role)}`}>
                                {user.role}
                              </span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}>
                                {status === 'active' ? 'Active' : 'Pending'}
                              </span>
                              <span>{lastSeenDate}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${roleBadgeClass(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}>
                          {status === 'active' ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{lastSeenDate}</td>
                      <td className="px-4 py-3 text-right sm:px-6">
                        <div className="inline-flex items-center gap-2">
                          <IconActionButton
                            title="Edit user"
                            ariaLabel={`Edit user ${user.email}`}
                            onClick={() => openEdit(user)}
                            icon={<UserCog className="h-3.5 w-3.5" />}
                          />
                          {user.role !== 'admin' ? (
                            <IconActionButton
                              title="Delete user"
                              ariaLabel={`Delete user ${user.email}`}
                              onClick={() => setDeleteTarget(user)}
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              destructive
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 ? (
                  <ListingStateRow colSpan={5} text="No users match the current filters." />
                ) : null}
              </tbody>
            </table>
          </ListingTableScroller>
        </ListingTableCard>
      )}

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInviteBusy(false);
            setInviteEmail('');
            setInviteRole('author');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invite email and pre-assign a role.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleInvite}>
            <div>
              <label htmlFor="invite-email" className="mb-1 block text-sm font-medium">Email</label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-medium">Role</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(normalizeRole(event.target.value))}
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="author">Author</option>
                <option value="reader">Reader</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <button type="button" className="btn btn-outline" onClick={() => setInviteOpen(false)} disabled={inviteBusy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={inviteBusy}>
                {inviteBusy ? 'Sending…' : 'Send Invitation'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => (open ? undefined : closeEdit())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role, account info, and profile fields.
            </DialogDescription>
          </DialogHeader>
          {editingUser ? (
            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-user-email" className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    id="edit-user-email"
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-role" className="mb-1 block text-sm font-medium">Role</label>
                  <select
                    id="edit-user-role"
                    value={editForm.role}
                    onChange={(event) => setEditForm((current) => ({ ...current, role: normalizeRole(event.target.value) }))}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  >
                    <option value="reader">Reader</option>
                    <option value="author">Author</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-user-name" className="mb-1 block text-sm font-medium">Full Name</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editForm.fullName}
                    onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="Optional display name"
                  />
                </div>
                <div>
                  <label htmlFor="edit-user-avatar-source" className="mb-1 block text-sm font-medium">Avatar Source</label>
                  <select
                    id="edit-user-avatar-source"
                    value={editForm.avatarSource}
                    onChange={(event) => setEditForm((current) => ({ ...current, avatarSource: normalizeAvatarSource(event.target.value) }))}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  >
                    <option value="gravatar">Gravatar</option>
                    <option value="custom">Custom URL</option>
                  </select>
                </div>
              </div>

              {editForm.avatarSource === 'custom' ? (
                <div>
                  <label htmlFor="edit-user-avatar-url" className="mb-1 block text-sm font-medium">Avatar URL</label>
                  <input
                    id="edit-user-avatar-url"
                    type="url"
                    value={editForm.avatarUrl}
                    onChange={(event) => setEditForm((current) => ({ ...current, avatarUrl: event.target.value }))}
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="edit-user-bio" className="mb-1 block text-sm font-medium">Bio</label>
                <textarea
                  id="edit-user-bio"
                  rows={4}
                  value={editForm.bio}
                  onChange={(event) => setEditForm((current) => ({ ...current, bio: event.target.value }))}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Optional profile bio"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editForm.emailConfirmed}
                  onChange={(event) => setEditForm((current) => ({ ...current, emailConfirmed: event.target.checked }))}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                Email confirmed
              </label>

              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Created: {formatDate(editingUser.createdAt)} • Last sign in: {formatDate(editingUser.lastSignInAt)}
              </div>

              <DialogFooter>
                <button type="button" className="btn btn-outline" onClick={closeEdit} disabled={editBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                  {editBusy ? 'Saving…' : 'Save User'}
                </button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteBusy(false);
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will permanently remove ${deleteTarget.email}.`
                : 'This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Cancel
            </button>
            <button type="button" className="btn btn-destructive" onClick={handleDeleteConfirmed} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete User'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
