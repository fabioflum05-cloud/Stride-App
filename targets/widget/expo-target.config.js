/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: 'widget',
  icon: '../../assets/images/icon.png',
  colors: {
    $accent: '#E8572A',
    $widgetBackground: '#1A1614',
  },
  frameworks: ['SwiftUI', 'WidgetKit'],
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'],
  },
});
