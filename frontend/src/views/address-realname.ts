/** 已实名认证的用户修改地址时，可不重复填写身份证号。 */
export function validateIdcardForSave(idcard: string, hasSavedRealname: boolean): string | null {
  if (!idcard) return hasSavedRealname ? null : '请填写身份证号'
  return /^\d{17}[\dXx]$/.test(idcard) ? null : '身份证号格式不正确（18 位，末位可为 X）'
}
