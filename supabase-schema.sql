create table if not exists workspace_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

insert into workspace_state (id, data)
values (
  'main',
  '{
    "theme": "light",
    "view": "today",
    "today": [],
    "week": [],
    "weekHistory": [],
    "links": [],
    "ideas": []
  }'::jsonb
)
on conflict (id) do nothing;
