/* eslint-env jest */
// Stand-in page component for routing tests. Exported as CommonJS so it can be
// `require`d from inside hoisted jest.mock factories.
const React = require("react");

module.exports = function mockPage(name) {
  const Page = () => React.createElement("p", null, `${name} page`);
  Page.displayName = `MockPage(${name})`;
  return Page;
};
