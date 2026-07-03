export const isGibberish = (text) => {
  if (!text) return false;
  
  // Clean text and check length
  const noSpaces = text.replace(/\s+/g, '');
  if (noSpaces.length < 5) return false; // Short acronyms/words usually pass

  // Check vowel ratio
  const vowels = noSpaces.match(/[aeiouy]/gi);
  const vowelCount = vowels ? vowels.length : 0;
  
  // If it's a longer string and has very few vowels (e.g. "sdfghjkl")
  if (noSpaces.length > 8 && vowelCount / noSpaces.length < 0.15) {
    return true;
  }

  // Check for 5 or more consecutive consonants (excluding 'y')
  if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(noSpaces)) {
    return true;
  }

  // Check for highly repetitive characters (e.g. "aaaaaa" or "hhhhhh")
  if (/(.)\1{4,}/i.test(noSpaces)) {
    return true;
  }

  return false;
};
