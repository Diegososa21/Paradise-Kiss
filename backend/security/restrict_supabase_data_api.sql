-- Paradise Kiss is accessed through Django, never directly through PostgREST.
-- Keep public API roles away from Django authentication, sessions and inventory.

begin;

revoke all privileges on table
  public.django_migrations,
  public.django_content_type,
  public.auth_permission,
  public.auth_group,
  public.auth_group_permissions,
  public.auth_user,
  public.auth_user_groups,
  public.auth_user_user_permissions,
  public.django_admin_log,
  public.django_session,
  public.resources_resources,
  public.resources_category,
  public.resources_gender,
  public.resources_manufacturer
from anon, authenticated;

revoke all privileges on all sequences in schema public from anon, authenticated;

alter table public.django_migrations enable row level security;
alter table public.django_content_type enable row level security;
alter table public.auth_permission enable row level security;
alter table public.auth_group enable row level security;
alter table public.auth_group_permissions enable row level security;
alter table public.auth_user enable row level security;
alter table public.auth_user_groups enable row level security;
alter table public.auth_user_user_permissions enable row level security;
alter table public.django_admin_log enable row level security;
alter table public.django_session enable row level security;
alter table public.resources_resources enable row level security;
alter table public.resources_category enable row level security;
alter table public.resources_gender enable row level security;
alter table public.resources_manufacturer enable row level security;

commit;
