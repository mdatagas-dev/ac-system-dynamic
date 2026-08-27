// Pure. `model.model` stores the model name with a 5-char brand suffix; routes strip the last
// 5 chars before joining against bomlist.
function stripBrandSuffix(model) {
  return model.slice(0, model.length - 5);
}

module.exports = { stripBrandSuffix };