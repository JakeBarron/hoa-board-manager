-- Add a Google Drive folder URL setting for auto-filling the minutes export flow.

insert into settings (key, value, description)
values (
  'drive_folder_url',
  '',
  'Google Drive folder URL where meeting minutes are uploaded. Shown in the meeting runner export screen.'
)
on conflict (key) do nothing;
