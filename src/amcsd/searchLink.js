// A link to an AMCSD record's search on the site, by its AMCSD code (e.g.
// "0014553"). The search key is ODR's JSON key, base64url-encoded the way ODR
// encodes it (b64EncodeUnicode): field 7191 is database_code_amcsd and 771 is
// the AMCSD datatype. The value is unquoted, as the site's own search writes
// it ({"7191":"0014553","dt_id":"771"}). Theme 0 is the
// database's default. Relative, so it stays on whichever site the plugin is on.
const AMCSD_SEARCH_STUB = "/odr/amcsd#/odr/search/display/0/";
const AMCSD_CODE_FIELD_ID = "7191";
const AMCSD_DATATYPE_ID = "771";

function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function amcsdSearchUrl(amcsdId) {
  const key = { [AMCSD_CODE_FIELD_ID]: amcsdId, dt_id: AMCSD_DATATYPE_ID };
  return AMCSD_SEARCH_STUB + b64EncodeUnicode(JSON.stringify(key));
}
