const { config } = require('@tamagui/config/v3')
const { createTamagui } = require('tamagui')

const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      background: '#F8F7F4', // Light warm background
      color: '#1C1C1E', // Dark text
      primary: '#FF6B4A', // Sunset Orange
      secondary: '#FF9E80',
    },
  },
})

module.exports = tamaguiConfig

