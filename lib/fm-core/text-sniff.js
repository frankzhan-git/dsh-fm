// 文本嗅探（纯函数，零依赖 —— 单测直接 import）。
// 兜底预览的判定信号（已知图片/已知文本扩展名先行，本函数只服务"未知类型"）：
//   - 采样含 NUL 字节 → 二进制（.exe/.zip/.png 头等强信号）
//   - 采样过短（<16B）→ 视为文本（短内容无二进制典型头）
//   - 其余按"非打印控制字符占比 ≤ 2%"判定（保留 \t\n\r；UTF-8 多字节高位字节不视为控制字符）
// 已知局限：UTF-16 文本含 NUL 会被判为二进制（该编码在本工作区场景罕见，README 已注明）。
export const TEXT_SNIFF_SAMPLE = 8192 // 采样字节数（读取头 8KB，成本可忽略）

export const sniffText = (bytes) => {
  if (!bytes || bytes.length === 0) return true
  let bad = 0
  const n = bytes.length
  for (let i = 0; i < n; i++) {
    const b = bytes[i]
    if (b === 0) return false // NUL：二进制强信号（先于短样本规则，PNG 签名等短头含 NUL 必须判二进制）
    // 非打印控制字符（保留 \t \n \r）
    if ((b < 0x20 && b !== 0x09 && b !== 0x0A && b !== 0x0D) || b === 0x7F) bad++
  }
  // 采样过短且无 NUL → 文本（短内容无二进制典型头）
  if (n < 16) return true
  return bad / n <= 0.02
}
