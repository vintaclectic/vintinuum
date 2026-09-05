fx_version 'cerulean'
game 'gta5'

author 'Vintinuum Council'
description 'Standalone configurable RP business money-delivery, reputation, loyalty, protection, and crew takeover resource.'
version '1.1.0'

lua54 'yes'

shared_scripts {
  'config.lua',
  'shared/businesses.lua'
}

client_scripts {
  'client/main.lua'
}

server_scripts {
  'server/main.lua'
}

files {
  'data/businesses.json',
  'data/control.json'
}
