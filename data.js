// 印紙いくら？の問題を作る（ブラウザと node の両方で使う）。
// 中身は、国税庁タックスアンサー No.7105（金銭又は有価証券の受取書、領収書）・No.7140／No.7141（印紙税額の一覧表）・No.7108（不動産の譲渡、建設工事の請負に関する契約書の軽減措置）に書いてあることだけ（［令和8年4月1日現在法令等］。2026-11-17 に読んだ。要点は共有フォルダ games/inshi-ikura-research.md）。
// 1問は、領収書や契約書の場面と金額を読んで、貼る収入印紙の額を選ぶ。正解したら2段目「どの文書？」を選ぶ。
// 答えはコードで表（TAB）から計算する。金額は種で決まる（同じ tag なら、どの端末でも同じ問題になる）。
// 軽減措置は「平成26年4月1日から令和9年3月31日までの間に作成される」契約書だけ。期限が延びた・切れたら表と画面を直す（QA が期限を見る）。
// 消費税額の区分記載（No.7124）・電子で作った領収書・印紙を貼り忘れたときの過怠税は扱わない（画面に書く）。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。
// KINDS の並びは最後に足すだけにする（並べ替え・削除をすると過去の日の問題が変わる）。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const AS_OF = "令和8年4月1日現在法令等", KEIGEN_END = "2027-03-31";

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    r: ["国税庁 タックスアンサー No.7105 金銭又は有価証券の受取書、領収書", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7105.htm"],
    t2: ["国税庁 タックスアンサー No.7141 印紙税額の一覧表（その2）第5号～第20号文書", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7141.htm"],
    t1: ["国税庁 タックスアンサー No.7140 印紙税額の一覧表（その1）第1号～第4号文書", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7140.htm"],
    kg: ["国税庁 タックスアンサー No.7108 不動産の譲渡、建設工事の請負に関する契約書の軽減措置", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7108.htm"],
  };
  const MEDIA = { ryo: "領収書", kei: "契約書" };

  // 税額の表。[この金額以下, 税額]。最後は上限なし。金額は円。税額 0 は非課税。
  const MAN = 10000, OKU = 100000000;
  const TAB = {
    // 第17号の1 売上代金に係る金銭の受取書（No.7141・No.7105）
    uri: [[49999, 0], [100 * MAN, 200], [200 * MAN, 400], [300 * MAN, 600], [500 * MAN, 1000], [1000 * MAN, 2000], [2000 * MAN, 4000], [3000 * MAN, 6000], [5000 * MAN, 10000], [OKU, 20000], [2 * OKU, 40000], [3 * OKU, 60000], [5 * OKU, 100000], [10 * OKU, 150000], [Infinity, 200000]],
    // 第17号の2 売上代金以外の金銭の受取書（No.7141）
    sonota: [[49999, 0], [Infinity, 200]],
    // 第1号文書（不動産・無体財産権などの譲渡の契約書。No.7140）
    dai1: [[9999, 0], [10 * MAN, 200], [50 * MAN, 400], [100 * MAN, 1000], [500 * MAN, 2000], [1000 * MAN, 10000], [5000 * MAN, 20000], [OKU, 60000], [5 * OKU, 100000], [10 * OKU, 200000], [50 * OKU, 400000], [Infinity, 600000]],
    // 第2号文書（請負に関する契約書。No.7140）
    dai2: [[9999, 0], [100 * MAN, 200], [200 * MAN, 400], [300 * MAN, 1000], [500 * MAN, 2000], [1000 * MAN, 10000], [5000 * MAN, 20000], [OKU, 60000], [5 * OKU, 100000], [10 * OKU, 200000], [50 * OKU, 400000], [Infinity, 600000]],
    // 軽減措置：不動産の譲渡に関する契約書（No.7108。10万円以下は軽減の対象外）
    fudosan: [[9999, 0], [10 * MAN, 200], [50 * MAN, 200], [100 * MAN, 500], [500 * MAN, 1000], [1000 * MAN, 5000], [5000 * MAN, 10000], [OKU, 30000], [5 * OKU, 60000], [10 * OKU, 160000], [50 * OKU, 320000], [Infinity, 480000]],
    // 軽減措置：建設工事の請負に関する契約書（No.7108。100万円以下は軽減の対象外）
    kensetsu: [[9999, 0], [100 * MAN, 200], [200 * MAN, 200], [300 * MAN, 500], [500 * MAN, 1000], [1000 * MAN, 5000], [5000 * MAN, 10000], [OKU, 30000], [5 * OKU, 60000], [10 * OKU, 160000], [50 * OKU, 320000], [Infinity, 480000]],
  };
  const taxOf = (t, yen) => { for (const [max, tax] of TAB[t]) if (yen <= max) return tax; return null; };

  // 2段目「どの文書？」
  const GROUPS = {
    uri: { name: "売上代金の受取書", sub: "第17号の1（商品の代金・家賃・工事代金など）", set: "all" },
    sonota: { name: "売上代金以外の受取書", sub: "第17号の2（借入金・保険金・損害賠償金など）", set: "all" },
    hieigyo: { name: "営業に関しない受取書", sub: "非課税（会社でない個人・公益法人など）", set: "all" },
    fudosan: { name: "不動産の譲渡の契約書", sub: "第1号の1（軽減措置あり）", set: "all" },
    dai1: { name: "そのほかの譲渡の契約書", sub: "第1号（特許権・営業の譲渡など。軽減なし）", set: "all" },
    kensetsu: { name: "建設工事の請負の契約書", sub: "第2号（軽減措置あり）", set: "all" },
    ukeoi: { name: "そのほかの請負の契約書", sub: "第2号（建設工事でない請負。軽減なし）", set: "all" },
  };
  const GRP_WHY = {
    uri: "商品の代金・家賃・請負の代金など、売上代金を受け取った受取書は第17号の1です。5万円未満は非課税、5万円以上100万円以下は200円で、金額が上がると段階的に上がります。",
    sonota: "借入金・保険金・損害賠償金・返還金など、売上代金でないお金の受取書は第17号の2です。5万円未満は非課税、5万円以上は金額によらず200円です。",
    hieigyo: "営業に関しない受取書は非課税です。会社や商人の受取書は営業に関するものになりますが、商人でない個人が自分の物を売ったときや、公益法人の受取書は営業に当たりません。",
    fudosan: "土地や建物の売買契約書は第1号の1です。令和9年3月31日までに作る契約書で、契約金額が10万円を超えるものは軽減された税額になります。",
    dai1: "特許権などの無体財産権や営業の譲渡の契約書も第1号ですが、軽減措置は不動産の譲渡だけなので、本来の税額です。",
    kensetsu: "建物の建築など建設工事の請負契約書は第2号です。令和9年3月31日までに作る契約書で、契約金額が100万円を超えるものは軽減された税額になります。",
    ukeoi: "ホームページ制作や清掃など、建設工事でない請負の契約書も第2号ですが、軽減措置は建設工事だけなので、本来の税額です。",
  };

  // 種類：[id, 難しさ, 2段目, 税の表, 媒体, 場面（＄ が金額）, 金額の下限, 上限, 刻み, ヒント1, 出典]
  // 金額は [下限, 上限] の中から「刻み」の倍数で選ぶ（境目そのものを出す種類は 下限=上限）。
  const D = [
    ["r_hikazei", 0, "uri", "uri", "ryo", "雑貨店が、お客さんから品物の代金＄を受け取って領収書を出す。", 10000, 49000, 1000, "売上代金の受取書は、金額がいくら未満なら非課税？", ["r", "t2"]],
    ["r_200", 0, "uri", "uri", "ryo", "家具店が、お客さんからソファーの代金＄を受け取って領収書を出す。", 50000, 1000000, 10000, "5万円以上100万円以下の領収書は？", ["r", "t2"]],
    ["r_400", 0, "uri", "uri", "ryo", "電器店が、会社から業務用の機械の代金＄を受け取って領収書を出す。", 1010000, 2000000, 10000, "100万円を超え200万円以下は？", ["r", "t2"]],
    ["r_600", 0, "uri", "uri", "ryo", "工務店が、お客さんから修理工事の代金＄を受け取って領収書を出す。", 2010000, 3000000, 10000, "200万円を超え300万円以下は？", ["r", "t2"]],
    ["r_1000", 0, "uri", "uri", "ryo", "車の販売店が、お客さんから車の代金＄を受け取って領収書を出す。", 3010000, 5000000, 10000, "300万円を超え500万円以下は？", ["r", "t2"]],
    ["s_200", 0, "sonota", "sonota", "ryo", "会社が、取引先から借入金＄を受け取って受取書を出す。", 50000, 5000000, 10000, "借入金は売上代金ではありません。", ["t2"]],
    ["s_hikazei", 0, "sonota", "sonota", "ryo", "会社が、保険会社から保険金＄を受け取って受取書を出す。", 10000, 49000, 1000, "売上代金以外の受取書も、5万円未満は？", ["t2"]],
    ["h_kojin", 0, "hieigyo", "uri", "ryo", "会社員が、使わなくなった自分の家具を知人に売って、代金＄の領収書を書く。", 60000, 900000, 10000, "商人でない個人が自分の物を売るのは、営業に当たる？", ["r"]],
    ["f_200", 0, "fudosan", "fudosan", "kei", "個人どうしで、小さな土地の売買契約書を作る。契約金額は＄。", 110000, 500000, 10000, "不動産の譲渡で、10万円を超え50万円以下は？（令和9年3月31日までに作る契約書）", ["t1", "kg"]],
    ["k_small", 0, "kensetsu", "kensetsu", "kei", "家の外壁の塗り替え工事の請負契約書を作る。契約金額は＄。", 100000, 1000000, 10000, "建設工事の請負で、100万円以下は軽減の対象？", ["t1", "kg"]],
    ["r_2000", 1, "uri", "uri", "ryo", "不動産会社が、会社から事務所の家賃1年分＄を受け取って領収書を出す。", 5010000, 10000000, 10000, "500万円を超え1千万円以下は？", ["r", "t2"]],
    ["r_4000", 1, "uri", "uri", "ryo", "建設会社が、施主から工事代金＄を受け取って領収書を出す。", 10100000, 20000000, 100000, "1千万円を超え2千万円以下は？", ["t2"]],
    ["r_nashi", 1, "uri", "uri", "ryo", "文具店が、会社から品物の代金を受け取ったが、金額を書かずに「代金を受け取りました」とだけ書いた受取書を出す。", 0, 0, 1, "受取金額の記載のない受取書は？", ["t2"]],
    ["h_koeki", 1, "hieigyo", "uri", "ryo", "公益財団法人が、講座の受講料＄を受け取って領収書を出す。", 60000, 900000, 10000, "公益法人の行為は、営業に当たる？", ["r"]],
    ["f_500", 1, "fudosan", "fudosan", "kei", "土地の売買契約書を作る。契約金額は＄。", 510000, 1000000, 10000, "不動産の譲渡で、50万円を超え100万円以下は？（軽減後）", ["t1", "kg"]],
    ["f_1000", 1, "fudosan", "fudosan", "kei", "中古の家の売買契約書を作る。契約金額は＄。", 1010000, 5000000, 10000, "不動産の譲渡で、100万円を超え500万円以下は？（軽減後）", ["t1", "kg"]],
    ["f_5000", 1, "fudosan", "fudosan", "kei", "中古マンションの売買契約書を作る。契約金額は＄。", 5100000, 10000000, 100000, "不動産の譲渡で、500万円を超え1千万円以下は？（軽減後）", ["t1", "kg"]],
    ["k_200", 1, "kensetsu", "kensetsu", "kei", "家の屋根の修理工事の請負契約書を作る。契約金額は＄。", 1010000, 2000000, 10000, "建設工事の請負で、100万円を超え200万円以下は？（軽減後）", ["t1", "kg"]],
    ["k_500", 1, "kensetsu", "kensetsu", "kei", "台所のリフォーム工事の請負契約書を作る。契約金額は＄。", 2010000, 3000000, 10000, "建設工事の請負で、200万円を超え300万円以下は？（軽減後）", ["t1", "kg"]],
    ["k_1000", 1, "kensetsu", "kensetsu", "kei", "車庫を建てる工事の請負契約書を作る。契約金額は＄。", 3010000, 5000000, 10000, "建設工事の請負で、300万円を超え500万円以下は？（軽減後）", ["t1", "kg"]],
    ["u_400", 1, "ukeoi", "dai2", "kei", "会社のホームページを作る仕事の請負契約書を作る。契約金額は＄。", 1010000, 2000000, 10000, "建設工事でない請負は、軽減の対象？", ["t1", "kg"]],
    ["d1_1000", 1, "dai1", "dai1", "kei", "特許権を譲る契約書を作る。契約金額は＄。", 510000, 1000000, 10000, "特許権の譲渡は第1号。軽減は不動産だけ。", ["t1", "kg"]],
    ["r_kyokai", 2, "uri", "uri", "ryo", "家具店が、お客さんから品物の代金ちょうど＄を受け取って領収書を出す。", 1000000, 1000000, 1, "「100万円以下」はちょうど100万円をふくむ？", ["t2"]],
    ["r_kyokai5", 2, "uri", "uri", "ryo", "パソコン店が、お客さんから品物の代金ちょうど＄を受け取って領収書を出す。", 50000, 50000, 1, "「5万円未満」はちょうど5万円をふくむ？", ["r", "t2"]],
    ["r_heiki", 2, "uri", "uri", "ryo", "商店が、取引先から商品代金30,000円と貸付金の返済30,000円を受け取り、それぞれの額を分けて書いた1枚の受取書を出す。", 0, 0, 1, "非課税かどうかは合計で見る。税額を決める記載金額は？", ["r"]],
    ["r_4man", 2, "uri", "uri", "ryo", "建設会社が、施主からビルの工事代金＄を受け取って領収書を出す。", 110000000, 200000000, 1000000, "1億円を超え2億円以下は？", ["t2"]],
    ["r_10man", 2, "uri", "uri", "ryo", "不動産会社が、会社から土地の代金＄を受け取って領収書を出す。", 310000000, 500000000, 10000000, "3億円を超え5億円以下は？", ["t2"]],
    ["f_1man", 2, "fudosan", "fudosan", "kei", "家の売買契約書を作る。契約金額は＄。", 11000000, 50000000, 1000000, "不動産の譲渡で、1千万円を超え5千万円以下は？（軽減後）", ["t1", "kg"]],
    ["f_3man", 2, "fudosan", "fudosan", "kei", "マンション1棟の売買契約書を作る。契約金額は＄。", 51000000, 100000000, 1000000, "不動産の譲渡で、5千万円を超え1億円以下は？（軽減後）", ["t1", "kg"]],
    ["f_10man", 2, "fudosan", "fudosan", "kei", "土地の売買契約書を作る。契約金額はちょうど＄。", 100000, 100000, 1, "10万円以下は軽減の対象外。第1号の本来の額は？", ["t1", "kg"]],
    ["k_1man", 2, "kensetsu", "kensetsu", "kei", "家を新しく建てる工事の請負契約書を作る。契約金額は＄。", 11000000, 50000000, 1000000, "建設工事の請負で、1千万円を超え5千万円以下は？（軽減後）", ["t1", "kg"]],
    ["k_6man", 2, "kensetsu", "kensetsu", "kei", "ビルを建てる工事の請負契約書を作る。契約金額は＄。", 110000000, 500000000, 10000000, "建設工事の請負で、1億円を超え5億円以下は？（軽減後）", ["t1", "kg"]],
    ["u_2000", 2, "ukeoi", "dai2", "kei", "会社の基幹システムを作る仕事の請負契約書を作る。契約金額は＄。", 3010000, 5000000, 10000, "建設工事でない請負で、300万円を超え500万円以下は？", ["t1", "kg"]],
    ["d1_eigyo", 2, "dai1", "dai1", "kei", "店の営業を丸ごと譲る契約書を作る。契約金額は＄。", 1010000, 5000000, 10000, "営業の譲渡は第1号。軽減は不動産だけ。", ["t1", "kg"]],
    ["k_nashi", 2, "kensetsu", "kensetsu", "kei", "建物を直す工事の請負契約書を作ったが、契約金額を書いていない。", 0, 0, 1, "契約金額の記載のない契約書は？", ["t1"]],
  ];

  const yen = (n) => n.toLocaleString("ja-JP") + "円";
  const man = (n) => (n >= OKU && n % OKU === 0 ? `${n / OKU}億円` : n >= OKU ? `${Math.floor(n / OKU)}億${((n % OKU) / MAN).toLocaleString("ja-JP")}万円` : n >= MAN && n % MAN === 0 ? `${(n / MAN).toLocaleString("ja-JP")}万円` : yen(n));
  const label = (t) => (t === 0 ? "いらない（非課税）" : yen(t));
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }

  // 答えの額。営業に関しない受取書は非課税。金額の記載のないものは200円。並記の受取書は売上代金の分（非課税の判定は合計）。
  function answerOf(id, grp, tab, amt) {
    if (grp === "hieigyo") return 0;
    if (id === "r_nashi" || id === "k_nashi") return 200;
    if (id === "r_heiki") return 60000 >= 50000 ? 200 : 0;
    return taxOf(tab, amt);
  }
  function maker(id, lv, grp, tab, sent, lo, hi, step) {
    return (R) => {
      const n = Math.floor((hi - lo) / step), amt = lo + ri(R, 0, n) * step, ans = answerOf(id, grp, tab, amt);
      const sentence = sent.replace("＄", man(amt));
      // 選び肢：答え・同じ表の前後の段・非課税・200円・軽減前の額（あれば）から4つ
      const T = TAB[tab].map((x) => x[1]), cand = new Set([0, 200]);
      const i = TAB[tab].findIndex((x) => amt <= x[0]);
      for (const j of [i - 1, i + 1, i + 2]) if (T[j] != null) cand.add(T[j]);
      if (tab === "fudosan") cand.add(taxOf("dai1", amt)); if (tab === "kensetsu") cand.add(taxOf("dai2", amt));
      if (tab === "dai1") cand.add(taxOf("fudosan", amt)); if (tab === "dai2") cand.add(taxOf("kensetsu", amt));
      if (grp === "hieigyo") cand.add(taxOf("uri", amt));
      if (id === "r_heiki") { cand.add(400); cand.add(600); }
      cand.delete(ans);
      // 足りないときは、小さい額から順に足す（どの問題も選び肢は4つ）
      for (const x of [0, 200, 400, 600, 1000, 2000]) { if ([...cand].filter((y) => y != null).length >= 3) break; if (x !== ans) cand.add(x); }
      const wrong = pickN(R, [...cand].filter((x) => x != null).sort((a, b) => a - b), 3);
      const opts = shuffle(R, [ans, ...wrong]).map(label);
      return { type: "act", q: `${sentence}　印紙はいくら？`, opts, ans: label(ans), rev: false, full: `${sentence} → ${label(ans)}`, amt, tax: ans, v: `${amt}` };
    };
  }
  const KINDS = D.map(([id, lv, grp, tab, col, sent, lo, hi, step, look, src]) => ({ id, lv, grp, tab, col, sent, lo, hi, step, look, src, name: GROUPS[grp].name + "：" + sent.replace(/＄/, "○円").slice(0, 24) + "…", key: GROUPS[grp].name + "（" + GROUPS[grp].sub + "）", why: GRP_WHY[grp], make: maker(id, lv, grp, tab, sent, lo, hi, step) }));
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const GRP_OF = Object.fromEntries(KINDS.map((k) => [k.id, k.grp]));
  const groupsOf = (g) => Object.keys(GROUPS).filter((x) => GROUPS[x].set === GROUPS[g].set);

  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, grp: k.grp, gwhy: GRP_WHY[k.grp], media: MEDIA[k.col], src: k.src.map((s) => SRC[s]), ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const ISK = { KINDS, BY, GROUPS, GRP_OF, GRP_WHY, LV, SRC, MEDIA, TAB, AS_OF, KEIGEN_END, taxOf, kindsOf, groupsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = ISK; else root.ISK = ISK;
})(typeof self !== "undefined" ? self : this);
