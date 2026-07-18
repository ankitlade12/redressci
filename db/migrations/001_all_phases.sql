-- RedressCI production relational model (PostgreSQL 16+)
-- Runtime demo mode remains credential-free; set REDRESSCI_PERSIST for durable
-- local snapshots and use this schema for a production PostgreSQL adapter.

create extension if not exists pgcrypto;

create table workspaces (
  id text primary key,
  name text not null,
  plan text not null check (plan in ('free', 'partner', 'enterprise')),
  region text not null check (region in ('us', 'eu', 'apac')),
  retention_days integer not null check (retention_days between 1 and 3650),
  sso_required boolean not null default false,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table members (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('reporter', 'reviewer', 'developer', 'admin', 'partner')),
  locale text not null default 'en',
  conflict_disclosure text,
  compensation_cents integer not null default 0 check (compensation_cents >= 0),
  unique (workspace_id, email)
);

create table cases (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  reporter_id text references members(id) on delete set null,
  status text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  private_payload jsonb not null,
  anonymized_payload jsonb not null,
  synthetic boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index cases_workspace_status_idx on cases(workspace_id, status, updated_at desc);

create table consent_decisions (
  id text primary key,
  case_id text not null references cases(id) on delete cascade,
  actor_id text not null references members(id),
  scope text not null,
  action text not null check (action in ('granted', 'withdrawn')),
  reason text,
  created_at timestamptz not null default now()
);

create table encrypted_artifacts (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references cases(id) on delete cascade,
  object_key text not null unique,
  content_type text not null,
  bytes bigint not null,
  sha256 text not null,
  storage_region text not null,
  retention_until timestamptz not null,
  deleted_at timestamptz
);

create table evidence (
  id text primary key,
  case_id text not null references cases(id) on delete cascade,
  status text not null check (status in ('proposed', 'approved', 'rejected')),
  authority text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create table evidence_versions (
  id text primary key,
  evidence_id text not null references evidence(id) on delete cascade,
  version integer not null check (version > 0),
  content_hash text not null,
  locator text not null,
  excerpt text not null,
  reviewed_by text not null references members(id),
  reviewed_at timestamptz not null,
  supersedes text references evidence_versions(id),
  unique (evidence_id, version)
);

create table evaluations (
  id text not null,
  version integer not null,
  case_id text not null references cases(id) on delete cascade,
  schema_payload jsonb not null,
  schema_hash text not null,
  state text not null check (state in ('draft', 'reviewed', 'verified', 'invalidated')),
  created_at timestamptz not null default now(),
  primary key (id, version)
);

create table evidence_dependencies (
  id text primary key,
  evidence_version_id text not null references evidence_versions(id),
  dependent_type text not null check (dependent_type in ('assertion', 'evaluation', 'pack', 'receipt')),
  dependent_id text not null,
  state text not null check (state in ('current', 'invalidated', 'reviewed')),
  invalidated_at timestamptz,
  reason text
);

create index evidence_dependencies_lookup_idx on evidence_dependencies(evidence_version_id, state);

create table target_adapters (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('recorded', 'http', 'openai-compatible')),
  configuration jsonb not null,
  secret_reference text,
  enabled boolean not null default false
);

create table evaluation_jobs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  case_id text not null references cases(id) on delete cascade,
  idempotency_key text not null,
  state text not null check (state in ('queued', 'running', 'completed', 'failed')),
  payload jsonb not null,
  run_id text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, idempotency_key)
);

create table evaluation_runs (
  id text primary key,
  evaluation_id text not null,
  evaluation_version integer not null,
  target_version text not null,
  result text not null check (result in ('pass', 'fail', 'inconclusive')),
  score numeric(6,5) not null,
  model text not null,
  grader_version text not null,
  output_hash text not null,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (evaluation_id, evaluation_version) references evaluations(id, version)
);

create table assurance_reports (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references cases(id) on delete cascade,
  kind text not null check (kind in ('mutation', 'calibration', 'stability', 'scope-guard')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table review_tasks (
  id text primary key,
  case_id text not null references cases(id) on delete cascade,
  evidence_version_id text references evidence_versions(id),
  reason text not null,
  state text not null check (state in ('open', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table evaluation_packs (
  id text not null,
  version text not null,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  domain text not null,
  status text not null check (status in ('draft', 'released')),
  manifest jsonb not null,
  manifest_hash text not null,
  created_at timestamptz not null default now(),
  primary key (id, version)
);

create table pack_maintainers (
  pack_id text not null,
  pack_version text not null,
  member_id text not null references members(id),
  role text not null,
  conflict_disclosure text not null,
  compensation_cents integer not null default 0,
  primary key (pack_id, pack_version, member_id),
  foreign key (pack_id, pack_version) references evaluation_packs(id, version)
);

create table failure_fingerprints (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  case_id text not null references cases(id) on delete cascade,
  digest text not null,
  privacy_safe_features jsonb not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, case_id)
);

create table counterfactuals (
  id text primary key,
  case_id text not null references cases(id) on delete cascade,
  dimension text not null,
  input_text text not null,
  provenance text not null,
  sensitive boolean not null,
  status text not null check (status in ('proposed', 'approved', 'rejected')),
  reviewed_by text references members(id)
);

create table escrow_records (
  id text primary key,
  case_id text not null references cases(id) on delete cascade,
  partner_id text not null,
  object_key text not null,
  payload_hash text not null,
  state text not null check (state in ('sealed', 'verified')),
  created_at timestamptz not null default now()
);

create table proof_bundles (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references cases(id) on delete cascade,
  payload jsonb not null,
  payload_hash text not null,
  algorithm text not null,
  signature text not null,
  issued_at timestamptz not null default now()
);

create table integrations (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  kind text not null,
  configuration jsonb not null,
  secret_reference text,
  state text not null,
  last_delivery jsonb
);

create table recurrence_events (
  id text primary key,
  case_id text not null references cases(id) on delete cascade,
  product_version text not null,
  run_id text not null references evaluation_runs(id),
  detected_at timestamptz not null default now(),
  reopened boolean not null default true
);

create table audit_events (
  sequence bigint generated always as identity primary key,
  id text not null unique,
  workspace_id text not null references workspaces(id) on delete cascade,
  actor_id text not null,
  action text not null,
  subject_type text not null,
  subject_id text not null,
  details jsonb not null,
  created_at timestamptz not null default now(),
  previous_hash text not null,
  hash text not null unique
);

create index audit_workspace_sequence_idx on audit_events(workspace_id, sequence);
