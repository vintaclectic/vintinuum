fx_version 'cerulean'
game 'gta5'

author 'Vintinuum Council'
description 'Standalone configurable RP business money-delivery, reputation, loyalty, and protection resource.'
version '1.0.0'

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
