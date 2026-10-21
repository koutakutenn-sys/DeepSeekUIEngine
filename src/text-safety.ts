// Keep spelling/emoji joiners and complete RGI subdivision flags, while rejecting
// other invisible format, bidirectional and unsafe C0/C1 controls.
const unsafeText = /(?:(?![\u200c\u200d])\p{Cf})|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const rgiSubdivisionFlag = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu;
export const hasUnsafeText = (value: string) => unsafeText.test(value.replace(rgiSubdivisionFlag, ''));
