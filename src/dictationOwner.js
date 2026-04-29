let dictationOwner = null;

export function setDictationOwner(owner) {
  dictationOwner = owner;
}

export function getDictationOwner() {
  return dictationOwner;
}

export function clearDictationOwner(owner) {
  if (owner == null || dictationOwner === owner) {
    dictationOwner = null;
  }
}
