// Instagram is a validation-only layer. Do not randomly validate trends.
// When a real Instagram signal source is connected, this function should return
// a title-keyed map only for trends that are actually observed on Instagram.
async function validateTrends() {
  return {}
}

module.exports = { validateTrends }