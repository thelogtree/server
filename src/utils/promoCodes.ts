type PromoCodeMap = { [key in string]: number };
// code -> log limit

// must all be lowercased. we convert codes to lowercase before they pass through here.
export const AvailablePromoCodes = {
  zfellows: 80000,
};
