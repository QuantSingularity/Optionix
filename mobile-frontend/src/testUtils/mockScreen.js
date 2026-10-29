/* eslint-env jest */
// Builds a stand-in screen component for navigator tests: it renders its own
// name and one pressable "open-<route>" link per entry in `links`.
const React = require("react");
const { Pressable, Text } = require("react-native");

module.exports = function mockScreen(name, links = []) {
  const Mock = ({ navigation }) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(Text, null, name),
      ...links.map((route) =>
        React.createElement(
          Pressable,
          { key: route, onPress: () => navigation.navigate(route) },
          React.createElement(Text, null, `open-${route}`),
        ),
      ),
    );
  Mock.displayName = `MockScreen(${name})`;
  return Mock;
};
