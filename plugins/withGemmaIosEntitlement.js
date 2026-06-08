const { withEntitlementsPlist } = require('@expo/config-plugins');

const ENTITLEMENT_KEY = 'com.apple.developer.kernel.extended-virtual-addressing';

/**
 * Adds extended virtual addressing when extra.gemmaIosExtendedAddressing is true.
 * Required for Gemma 4 (>2 GB) on iOS. Needs a paid Apple Developer account.
 */
function withGemmaIosEntitlement(config) {
  const enabled = config.extra?.gemmaIosExtendedAddressing === true;
  if (!enabled) {
    return config;
  }

  return withEntitlementsPlist(config, (config) => {
    config.modResults[ENTITLEMENT_KEY] = true;
    return config;
  });
}

module.exports = withGemmaIosEntitlement;
