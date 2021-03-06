import test from "ava";
import { Promise } from "es6-promise";
const h = require("snabbdom/h");

import { newInstance } from "../../lib/index";

let createComponent = null;
let run = null;
let vnode = null;

const renderer = (model, root) => { vnode = root(model); };

test.beforeEach(function() {
  const Meiosis = newInstance();
  createComponent = Meiosis.createComponent;
  run = Meiosis.run;
});

test("calls the view with model and propose", t => {
  t.plan(3);

  const initialModel = { duck: "quack" };

  run({ renderer, initialModel, rootComponent: createComponent({
    view: (model, propose) => {
      t.truthy(model);
      t.truthy(propose);
      t.deepEqual(model, initialModel);
    }
  }) });
});

test("renders a view", t => {
  const initialModel = { duck: "quack" };

  const view = (model, _actions) => h("span", `A duck says ${model.duck}`);

  run({ renderer, initialModel, rootComponent: createComponent({ view: view }) });

  t.truthy(vnode);
  t.is(vnode.sel, "span");
  t.is(vnode.text, "A duck says quack");
});

test("renders a tree of views", t => {
  const FormText = "Form";
  const ListText = "List";

  const Form = createComponent({ view: _model => h("div", FormText) });
  const List = createComponent({ view: _model => h("div", ListText) });
  const Main = createComponent({ view: model => h("div", [Form(model), List(model)]) });

  run({ renderer, rootComponent: Main });

  t.truthy(vnode);
  t.is(vnode.sel, "div");
  t.is(vnode.children.length, 2);

  t.is(vnode.children[0].text, FormText);
  t.is(vnode.children[1].text, ListText);
});

test("triggers a proposal", t => {
  const PROPOSAL = "proposal";

  let propose = null;

  const Main = createComponent({
    initialModel: () => ({ name: "one" }),
    view: (model, propose_) => {
      propose = propose_;
      return h("span", model.name);
    },
    receive: (model, proposal) => {
      if (proposal === PROPOSAL) {
        return { name: "two" };
      }
      return model;
    }
  });

  run({ renderer, rootComponent: Main });
  t.is(vnode.text, "one");

  propose(PROPOSAL);
  t.is(vnode.text, "two");
});

test("nextAction", t => {
  const CHANGE = "change";
  const REFRESH = "refresh";

  const actions = propose => ({
    change: () => propose(CHANGE),
    refresh: () => propose(REFRESH)
  });

  let actionsRef = null;

  const Main = createComponent({
    initialModel: () => ({ name: "one" }),
    actions: actions,
    view: (model, actions_) => {
      actionsRef = actions_;
      return h("span", model.name);
    },
    receive: (model, proposal) => {
      if (proposal === CHANGE) {
        return { name: "two" };
      }
      else if (proposal === REFRESH) {
        return { name: "four" };
      }
      return model;
    },
    nextAction: ({model, proposal, actions}) => {
      if (proposal === CHANGE) {
        actions.refresh();
      }
    }
  });

  run({ renderer, rootComponent: Main });
  t.is(vnode.text, "one");

  actionsRef.change();
  t.is(vnode.text, "four");
});

test("merges the models into a single root model", t => {
  const PROPOSAL = "proposal";

  const actions = propose => ({
    doIt: () => propose(PROPOSAL)
  });

  let actionsRef = null;

  const Form = createComponent({
    initialModel: model => { model.formText = "F1"; return model; },
    view: model => h("span", model.formText)
  });

  const List = createComponent({
    initialModel: model => { model.listText = "L1"; return model; },
    view: model => h("span", model.listText)
  });

  const Main = createComponent({
    initialModel: model => { model.name = "one"; return model; },
    actions: actions,
    view: (model, actions) => {
      actionsRef = actions;
      return h("div",
        [ h("span", model.name)
        , Form(model)
        , List(model)
        ]
      );
    },
    receive: (model, proposal) => {
      if (proposal === PROPOSAL) {
        return { name: "two", formText: "F2", listText: "L2" };
      }
      return model;
    }
  });

  run({ renderer, rootComponent: Main });

  t.is(vnode.children.length, 3);
  t.is(vnode.children[0].text, "one");
  t.is(vnode.children[1].text, "F1");
  t.is(vnode.children[2].text, "L1");

  actionsRef.doIt();
  t.is(vnode.children[0].text, "two");
  t.is(vnode.children[1].text, "F2");
  t.is(vnode.children[2].text, "L2");
});

test("reflects change from one view in another view", t => {
  const CHANGE = "change";

  let propose = null;

  const Form = createComponent({
    initialModel: model => { model.formText = "F1"; return model; },
    view: model => h("span", model.formText)
  });

  const List = createComponent({
    initialModel: model => { model.listText = "L1"; return model; },
    view: (model, propose_) => {
      propose = propose_;
      return h("span", model.listText);
    },
    receive: (model, proposal) => {
      if (proposal === CHANGE) {
        model.formText = "F2";
        return model;
      }
      return model;
    }
  });

  const Main = createComponent({
    view: model => h("div",
      [ h("span", model.name)
      , Form(model)
      , List(model)
      ]
    )
  });

  run({ renderer, rootComponent: Main, initialModel: { name: "one" } });

  t.is(vnode.children.length, 3);
  t.is(vnode.children[0].text, "one");
  t.is(vnode.children[1].text, "F1");
  t.is(vnode.children[2].text, "L1");

  propose(CHANGE);
  t.is(vnode.children[0].text, "one");
  t.is(vnode.children[1].text, "F2");
  t.is(vnode.children[2].text, "L1");
});

test.cb("executes tasks", t => {
  t.plan(1);

  const INCREMENT = "increment";

  let value = 0;
  let actionsRef = null;

  const promise = new Promise<any>(res => res(42));

  const actions = propose => ({
    increment: () => promise.then(res => { value = res; propose(INCREMENT); })
  });

  run({ renderer, initialModel: { counter: 1 }, rootComponent: createComponent({
    actions: actions,
    view: (_model, actions) => {
      actionsRef = actions;
      return h("span", "test");
    },
    receive: (model, proposal) => {
      if (proposal === INCREMENT) {
        t.is(value, 42);
        t.end();
      }
      return model;
    }
  }) });

  actionsRef.increment();
});

test("accepts only specifying the view", t => {
  const FormText = "Form";
  const ListText = "List";

  const Form = createComponent({ view: _model => h("div", FormText) });
  const List = createComponent({ view: _model => h("div", ListText) });
  const Main = createComponent({ view: model => h("div", [Form(model), List(model)]) });

  run({ renderer, rootComponent: Main });

  t.truthy(vnode);
  t.is(vnode.sel, "div");
  t.is(vnode.children.length, 2);

  t.is(vnode.children[0].text, FormText);
  t.is(vnode.children[1].text, ListText);
});

test("all configs are optional, but you need something", t => {
  t.throws(() => createComponent(undefined));
  t.throws(() => createComponent(null));
  t.throws(() => createComponent({}));
});

test("allows to have only one config property", t => {
  createComponent({ postRender: () => null });
});

test("warns when initialModel is not a function", t => {
  t.throws(() => createComponent({
    initialModel: { duck: "yellow" }
  }));
});

test("passes propose to the view by default", t => {
  const CHANGE = "change";

  let propose = null;

  const Main = createComponent({
    view: (model, propose_) => {
      t.is(typeof propose_, "function");
      propose = propose_;
      return h("span", model.name);
    },
    receive: (model, proposal) => {
      if (proposal === CHANGE) {
        return { name: "two" };
      }
      return model;
    }
  });

  run({ renderer, initialModel: { name: "one" }, rootComponent: Main });
  t.is(vnode.text, "one");

  propose(CHANGE);
  t.is(vnode.text, "two");
});

test("passes the actions object to the view", t => {
  const CHANGE = "change";

  const actions = propose => ({
    test: () => propose(CHANGE)
  });

  let actionsRef = null;

  const Main = createComponent({
    initialModel: () => ({ name: "one" }),
    actions: actions,
    view: (model, actions) => {
      t.is(typeof actions, "object");
      actionsRef = actions;
      return h("span", model.name);
    },
    receive: (model, proposal) => {
      if (proposal === CHANGE) {
        return { name: "two" };
      }
      return model;
    }
  });

  run({ renderer, rootComponent: Main });
  t.is(vnode.text, "one");

  actionsRef.test();
  t.is(vnode.text, "two");
});

test("runs proposals through receive", t => {
  let propose = null;

  const Main = createComponent({
    initialModel: () => ({ name: "one" }),
    view: (model, propose_) => {
      propose = propose_;
      return h("span", model.name);
    },
    receive: (model, proposal) => {
      t.is(model.name, "one");
      t.is(proposal.name, "two");
      return { name: "three" };
    }
  });

  run({ renderer, rootComponent: Main });
  t.is(vnode.text, "one");

  propose({ name: "two" });
  t.is(vnode.text, "three");
});

test("calls one component's receive with another component's proposal", t => {
  let propose = null;

  const Child = createComponent({
    view: (model, propose_) => {
      propose = propose_;
      return h("span", model.name);
    }
  });

  const Main = createComponent({
    view: model => Child(model),
    receive: (model, proposal) => {
      t.is(model.name, "one");
      t.is(proposal.name, "two");
      return { name: "three" };
    }
  });

  run({ renderer, initialModel: { name: "one" }, rootComponent: Main });
  t.is(vnode.text, "one");

  propose({ name: "two" });
  t.is(vnode.text, "three");
});

test("supports multiple functions that receive proposals, in order of creation", t => {
  let propose = null;

  const Child = createComponent({
    view: (model, propose_) => {
      propose = propose_;
      return h("span", String(model.value));
    },
    receive: (model, proposal) => {
      t.is(model.value, 2);
      t.is(proposal.value, 3);
      return { value: model.value + 3 };
    }
  });

  const Main = createComponent({
    view: model => Child(model),
    receive: (model, proposal) => {
      t.is(model.value, 5);
      t.is(proposal.value, 3);
      return { value: model.value * 2 };
    }
  });

  run({ renderer, initialModel: { value: 2 }, rootComponent: Main });
  t.is(vnode.text, "2");

  propose({ value: 3 });
  t.is(vnode.text, "10");
});

test("returns a function to render a view from a model", t => {
  const initialModel = { duck: "quack" };

  const view = (model, _actions) => h("span", `A duck says ${model.duck}`);

  const renderRoot = run({ renderer, initialModel, rootComponent: createComponent({ view: view }) });

  t.truthy(vnode);
  t.is(vnode.sel, "span");
  t.is(vnode.text, "A duck says quack");

  const sound2 = "QUACK!";
  renderRoot({ duck: sound2 });
  t.is(vnode.text, "A duck says " + sound2);
});

test("returns the combined initial model", t => {
  createComponent({ initialModel: model => { model.duck = "quack"; return model; } });
  const Root = createComponent({ initialModel: model => { model.color = "yellow"; return model; } });
  const renderRoot = run({ renderer, initialModel: { one: "two" }, rootComponent: Root });
  t.deepEqual(renderRoot.initialModel, { one: "two", duck: "quack", color: "yellow" });
});

test("sends proposal through to the nextAction function", t => {
  t.plan(7);

  let propose = null;

  const Main = createComponent({
    initialModel: () => ({ name: "one" }),
    view: (model, propose_) => {
      propose = propose_;
      return h("span", model.name);
    },
    receive: (model, proposal) => {
      t.is(model.name, "one");
      t.is(proposal.name, "two");
      return { name: "three" };
    },
    nextAction: context => {
      t.is(context.model.name, "three");
      t.deepEqual(context.proposal, { name: "two" });
      t.is(context.propose, propose);
    }
  });

  run({ renderer, rootComponent: Main });
  t.is(vnode.text, "one");

  propose({ name: "two" });
  t.is(vnode.text, "three");
});

test("passes correct actions to each view", t => {
  const formActions = propose => ({
    formAction: () => propose("formAction")
  });

  const Form = createComponent({
    initialModel: model => { model.formText = "F1"; return model; },
    actions: formActions,
    view: (model, actions) => {
      t.truthy(actions.formAction);
      return h("span", model.formText);
    }
  });

  const listActions = propose => ({
    listAction: () => propose("listAction")
  });

  const List = createComponent({
    initialModel: model => { model.listText = "L1"; return model; },
    actions: listActions,
    view: (model, actions) => {
      t.truthy(actions.listAction);
      return h("span", model.listText);
    }
  });

  const mainActions = propose => ({
    mainAction: () => propose("mainAction")
  });

  const Main = createComponent({
    initialModel: model => { model.name = "one"; return model; },
    actions: mainActions,
    view: (model, actions) => {
      t.truthy(actions.mainAction);
      return h("div",
        [ h("span", model.name)
        , Form(model)
        , List(model)
        ]
      );
    }
  });

  run({ renderer, rootComponent: Main });

  t.is(vnode.children.length, 3);
  t.is(vnode.children[0].text, "one");
  t.is(vnode.children[1].text, "F1");
  t.is(vnode.children[2].text, "L1");
});

test("calls all nextAction functions and passes correct actions to the each one", t => {
  t.plan(8);

  let formActionsRef = null;
  let listActionsRef = null;

  const formActions = propose => ({
    formAction: () => propose("formAction")
  });

  const Form = createComponent({
    actions: formActions,
    view: (_model, actions) => {
      formActionsRef = actions;
      return h("span");
    },
    nextAction: context => {
      t.truthy(context.actions.formAction);
      t.falsy(context.actions.listAction);
    }
  });

  const listActions = propose => ({
    listAction: () => propose("listAction")
  });

  const List = createComponent({
    actions: listActions,
    view: (_model, actions) => {
      listActionsRef = actions;
      return h("span");
    },
    nextAction: context => {
      t.truthy(context.actions.listAction);
      t.falsy(context.actions.formAction);
    }
  });

  const Main = createComponent({
    initialModel: () => ({ name: "one" }),
    view: (model, _actions) => h("div",
      [ h("span", model.name)
      , Form(model)
      , List(model)
      ]
    )
  });

  run({ renderer, rootComponent: Main });

  formActionsRef.formAction();
  listActionsRef.listAction();
});

test("calls the ready function with propose", t => {
  t.plan(5);

  const initialModel = { duck: "quack" };

  const view = model => h("span", `A duck says ${model.duck}`);

  run({ renderer, initialModel, rootComponent: createComponent({
    view: view,
    ready: propose => {
      t.truthy(propose);
      t.is(typeof propose, "function");
    }
  }) });

  t.truthy(vnode);
  t.is(vnode.sel, "span");
  t.is(vnode.text, "A duck says quack");
});

test("calls the postRender function", t => {
  t.plan(1);

  const initialModel = { duck: "quack" };
  const view = model => h("span", `A duck says ${model.duck}`);

  run({ renderer, initialModel, rootComponent: createComponent({
    view: view,
    postRender: model => t.is(model, initialModel)
  }) });
});

test("can use a display function for an initial viewModel", t => {
  const initialModel = { value: 2 };

  const display = view => model => view({ value: model.value * 2 });
  const view = model => h("span", String(model.value));

  const Main = createComponent({ view: display(view) });

  run({ renderer, initialModel, rootComponent: Main });

  t.is(vnode.text, "4");
});

test("can use a state object in receive, and to decide which view to display", t => {
  const CHANGE = "change";

  let propose = null;

  const state = {
    isReady: model => model.value === 1,
    isSet: model => model.value === 2,
    isGo: model => model.value === 4
  };

  const view = {
    ready: (model, propose_) => {
      propose = propose_;
      return h("span", "ready");
    },
    set: (model, propose_) => h("span", "set"),
    go: (model, propose_) => h("span", "go")
  };

  const display = (state, view) => (model, propose) => {
    if (state.isReady(model)) {
      return view.ready(model, propose);
    }
    else if (state.isSet(model)) {
      return view.set(model, propose);
    }
    else if (state.isGo(model)) {
      return view.go(model, propose);
    }
  };

  const receive = state => (model, proposal) => {
    if (state.isReady(model)) {
      return { value: 2 };
    }
    else if (state.isSet(model)) {
      return { value: 4 };
    }
  };

  const Main = createComponent({
    view: display(state, view),
    receive: receive(state)
  });

  run({ renderer, initialModel: { value: 1 }, rootComponent: Main });
  t.is(vnode.text, "ready");

  propose(CHANGE);
  t.is(vnode.text, "set");

  propose(CHANGE);
  t.is(vnode.text, "go");
});
