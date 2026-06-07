export const SCREEN_PADDING = 24;

export const screenColors = {
  bg: '#f5f6fa',
  surface: '#fff',
  border: '#dce2f7',
  borderLight: '#e8ebf5',
  tint: '#f7f9ff',
};

export function screenContent(paddingBottom = 40) {
  return {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom,
  };
}

export function flatSection({ tinted = false, marginBottom = 0, paddingVertical = 12 } = {}) {
  return {
    backgroundColor: tinted ? screenColors.tint : screenColors.surface,
    marginHorizontal: -SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: screenColors.border,
    marginBottom,
  };
}

export function flatRow() {
  return {
    borderBottomWidth: 1,
    borderBottomColor: screenColors.borderLight,
    paddingVertical: 12,
  };
}

export function flatPressableRow({ last = false } = {}) {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: last ? 0 : 1,
    borderBottomColor: screenColors.borderLight,
  };
}

export function flatSelectedRow(selected = false) {
  return selected
    ? {
        backgroundColor: screenColors.tint,
        borderLeftWidth: 3,
        borderLeftColor: '#4f6ef7',
      }
    : {};
}
