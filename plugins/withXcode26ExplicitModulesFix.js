const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'SWIFT_ENABLE_EXPLICIT_MODULES';
const PODFILE_PATCH = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['${MARKER}'] = 'NO'
      end
    end

`;

function withXcode26ExplicitModulesFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;

      const podfilePath = path.join(iosRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          `post_install do |installer|\n${PODFILE_PATCH}`
        );
        fs.writeFileSync(podfilePath, contents);
      }

      const xcodeEnvPath = path.join(iosRoot, '.xcode.env');
      let xcodeEnv = fs.readFileSync(xcodeEnvPath, 'utf8');
      if (!xcodeEnv.includes('SENTRY_DISABLE_AUTO_UPLOAD')) {
        xcodeEnv += '\n# Skip sentry-cli upload unless SENTRY_ORG/SENTRY_PROJECT are configured\n';
        xcodeEnv += 'export SENTRY_DISABLE_AUTO_UPLOAD=true\n';
        fs.writeFileSync(xcodeEnvPath, xcodeEnv);
      }

      return config;
    },
  ]);
}

module.exports = withXcode26ExplicitModulesFix;
