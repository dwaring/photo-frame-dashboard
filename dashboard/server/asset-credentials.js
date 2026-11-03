// Access-protected assets need the session cookie, including on older WebKit.
export function credentialedAssets(html) {
  return html.replace(/<(?:script|link)\b[^>]*>/g, tag => {
    if (!/\b(?:src|href)=["']\/assets\//.test(tag)) return tag;
    const clean = tag.replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g, '');
    return clean.replace(/>$/, ' crossorigin="use-credentials">');
  });
}

export function accessAssetCredentials() {
  return { name: 'access-asset-credentials', apply: 'build', transformIndexHtml: { order: 'post', handler: credentialedAssets } };
}
