// Links to a record's search on the site. The search key is ODR's JSON key
// ({ fieldId: value, dt_id: datatypeId }), base64url-encoded the way ODR
// encodes it (b64EncodeUnicode). Values are unquoted, as the site's own
// search writes them ({"7191":"0014553","dt_id":"771"}). Theme 0 is the
// database's default. Relative, so it stays on whichever site the plugin is on.
function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function searchUrl(slug, fieldId, datatypeId, value) {
  const key = { [fieldId]: String(value), dt_id: datatypeId };
  return `/odr/${slug}#/odr/search/display/0/${b64EncodeUnicode(JSON.stringify(key))}`;
}

// AMCSD: field 7191 is database_code_amcsd, datatype 771.
export const amcsdSearchUrl = (amcsdId) => searchUrl("amcsd", "7191", "771", amcsdId);

// RRUFF Chemistry & Cell Parameters: field 7173 is Cell Parameter ID,
// datatype 768.
export const cellParamSearchUrl = (cellParamId) => searchUrl("rruff_cellparams", "7173", "768", cellParamId);
