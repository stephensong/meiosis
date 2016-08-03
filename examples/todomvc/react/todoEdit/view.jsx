/*global define, exports, module, require*/

// This boilerplate is to support running this code with either, just the browser, or RequireJS,
// or node.js / npm (browserify, webpack, etc.) Do not think this boilerplate is necessary to run
// Meiosis. It is for convenience to be able to run the example with your preferred module system.
(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["react"], function(React) {
      return (root.todoEditView = factory(React));
    });
  }
  else if (typeof module === "object" && module.exports) {
    module.exports = (root.todoEditView = factory(require("react")));
  }
  else {
    root.todoEditView = factory(root.React);
  }
}(this || window, // ^^ the code above is boilerplate. the "real" code starts below. vv

  function(React) {
    return {
      todoEdit: function(todo, actions) {
        var events = actions.events;

        return (
          <input type="text" className="edit" value={todo.title}
            onKeyUp={events.onEditKeyUp(todo.id)}
            onChange={events.onEditChange(todo.id)}
            onBlur={events.onEditBlur(todo.id)}
            autoFocus
          />
        );
      },

      noTodoInput: function() {
        return null;
      }
    };
  }
));
