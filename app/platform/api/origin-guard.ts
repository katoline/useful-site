/**
 * アプリの API の呼び出し元の検査（他サイトから API として使われるのを防ぐ）。
 * 使うのは image-adjust の fetch-image（中継 API。plan.md §3.5）と speed-test の計測 API。
 *
 * これはブラウザ経由の悪用（他サイトのページから利用者のブラウザに叩かせる・<img> で直リンクする）
 * への対策。ブラウザはページの JavaScript から Origin / Referer / Sec-Fetch-Site を偽れないので、
 * これらで自サイトからの呼び出しだけを通す。curl 等のブラウザ以外はヘッダーを自由に付けられるので
 * ここでは防げない。そちらは各 API の回数制限（rate-limit-key.ts）で抑える。
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** 開発・preview 用の loopback ホストか */
export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

function originOf(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/**
 * 許可するオリジンか。
 * - SITE_ORIGIN（本番のオリジン）
 * - リクエスト自身のオリジン（同一オリジンからの呼び出し。workers.dev とカスタムドメインの
 *   両方で配信している間も、表示中のページと同じオリジンなら通す）
 * - リクエスト自身が localhost 宛てのとき（開発・preview）だけ、localhost の任意ポート
 */
export function isAllowedOrigin(origin: string, requestUrl: URL, siteOrigin: string): boolean {
  if (origin === siteOrigin || origin === requestUrl.origin) return true;
  if (isLoopbackHost(requestUrl.hostname)) {
    try {
      const url = new URL(origin);
      return url.protocol === "http:" && isLoopbackHost(url.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 呼び出し元が自サイトかどうか。
 *
 * 1. Sec-Fetch-Site があれば same-origin 以外は拒否する（cross-site・same-site・none）。
 *    none（アドレスバーに API の URL を直接入れた等）も使い道が無いので拒否する
 * 2. Origin があればそれで判定する（"null" は拒否）
 * 3. Origin が無ければ Referer のオリジンで判定する
 * 4. どちらも無いときは、Sec-Fetch-Site: same-origin があるときだけ通す。
 *    同一オリジンの GET の fetch() にブラウザは Origin を付けず、Referrer-Policy 次第で
 *    Referer も付かないことがあるが、対応ブラウザは Sec-Fetch-Site を必ず付けるので、
 *    それを同一オリジンの証明として使う。3 つとも無いもの（古いブラウザ・ブラウザ以外）は拒否する。
 *    古いブラウザでも普通は Referer が付くので、自サイトの UI が使えなくなることはほぼ無い
 */
export function isAllowedCaller(headers: Headers, requestUrl: URL, siteOrigin: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") return false;

  const origin = headers.get("origin");
  if (origin !== null) {
    if (origin === "null") return false;
    return isAllowedOrigin(origin, requestUrl, siteOrigin);
  }

  const referer = headers.get("referer");
  if (referer) {
    const refererOrigin = originOf(referer);
    return refererOrigin !== undefined && isAllowedOrigin(refererOrigin, requestUrl, siteOrigin);
  }

  return fetchSite === "same-origin";
}
