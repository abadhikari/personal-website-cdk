module.exports = {
  test: (val) =>
    typeof val === 'string' && val.endsWith('.zip'),
  print: () => '"<ZIP_ASSET>"',
};