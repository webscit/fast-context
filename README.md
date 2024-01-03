# fast-element-context

## Overview

This package defines an implementation of controllers for using the [Context Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md) as defined by the Web Components Community Group with [FASTElement v1](https://github.com/microsoft/fast).

This protocol facilitates the communication between components lower in the DOM hierarchy with their ancestors, allowing data to be passed down the tree without having to be passed via 'prop drilling' where each element in the path passes on the data.

For further explanation of the Context Protocol please see the [community protocol documentation](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md).

It started from a fork of `@lit/context` at commit [v1.1.0](https://github.com/lit/lit/tree/%40lit/context%401.1.0).
The goal is to have the provider compatible with each others.

## Usage

There are several different usages of the Context API.

### Creating a Context

First lets define a context key we can use elsewhere in our examples:

#### **`logger.ts`**:

```ts
import {createContext} from 'fast-element-context';

export interface Logger {
  log: (msg: string) => void;
}

export const loggerContext = createContext<Logger>('logger');
```

### Consuming a Context

Now we can define a consumer for this context - some component in our app needs the logger.

Here we're using the `defineConsumer` helper to add a `ContextConsumer` behavior
and update its value when the context changes:

#### **`my-element.ts`**:

```ts
import {FASTElement, observable} from '@microsoft/fast-element';
import {defineConsumer} from 'fast-element-context';
import {Logger, loggerContext} from './logger.js';

export class MyElement extends FASTElement {
  @observable()
  public logger?: Logger;

  constructor() {
    super();
    defineConsumer(this, 'logger', {context: loggerContext, subscribe: true});
  }

  private doThing() {
    this.logger?.log('a thing was done');
  }
}
```

Another way we can use a context in a component is via the `ContextConsumer` behavior directly:

#### **`my-element.ts`**:

```ts
import {FASTElement} from '@microsoft/fast-element';
import {ContextConsumer} from 'fast-element-context';
import {Logger, loggerContext} from './logger.js';

export class MyElement extends FASTElement {
  public logger = new ContextConsumer(this, {
    context: loggerContext,
    subscribe: true, // pass true to get updates if the logger changes
  });

  private doThing() {
    this.logger.value?.log('a thing was done');
  }
}
```

### Providing a Context

Finally we want to be able to provide this context from somewhere higher in the DOM.

Here we're using the `defineProvider` helper to add a `ContextProvider`
behavior and update its value when the property value changes.

#### **`my-app.ts`**:

```ts
import {FASTElement, observable, html} from '@microsoft/fast-element';
import {provide} from 'fast-element-context';
import {loggerContext, Logger} from './logger.js';

export class MyApp extends FASTElement {
  @observable
  public logger: Logger = {
    log: (msg) => {
      console.log(`[my-app] ${msg}`);
    },
  });

  constructor() {
    super();
    defineProvider(this, 'logger', {context: loggerContext});
  }
}
```

We can also use the `ContextProvider` behavior directly:

#### **`my-app.ts`**:

```ts
import {FASTElement, html} from '@microsoft/fast-element';
import {ContextProvider} from 'fast-element-context';
import {loggerContext, Logger} from './logger.js';

export class MyApp extends LitElement {
  // create a provider controller and a default logger
  private provider = new ContextProvider(this, loggerContext, {
    log: (msg) => {
      console.log(`[my-app] ${msg}`);
    },
  });

  public setLogger(newLogger: Logger) {
    // update the provider with a new logger value
    this.provider.setValue(newLogger);
  }
}
```

`ContextProvider` can also be used with plain HTML elements. This can be
useful to provide a context provider without introducing a custom element:

#### **`my-app.js`**:

```js
import {ContextProvider} from 'fast-element-context';
import {loggerContext, Logger} from './logger.js';

// create a provider for the whole document body.
const loggingProvider = new ContextProvider(document.body, {
    context: loggerContext,
    initialValue: {
      log: (msg) => {
        console.log(`[global] ${msg}`);
      },
    },
);
```

If the provider is being added when there is already a consumer registered with
a parent of the specified element or with a `ContextRoot`, then
`.hostConnected()` must be called on the provider after creating it. This
ensures existing downstream consumers will now get their context values from the
closest parent provider.

## Known Issues

### Late upgraded Context Providers

In some cases you might have a context providing element that is upgraded late. LightDOM content below this provider may end up requesting a context that is currently not provided by any provider.

To solve this case we provide a `ContextRoot` class which can intercept and track unsatisfied `context-request` events and then redispatch these requests when providers are updated.

Example usage:

#### **`index.ts`**:

```ts
import {ContextRoot} from '@lit/context';
const root = new ContextRoot();
root.attach(document.body);
```

The `ContextRoot` can be attached to any element and it will gather a list of any context requests which are received at the attached element. The `ContextProvider` controllers will emit `context-provider` events when they are connected to the DOM. These events act as triggers for the `ContextRoot` to redispatch these `context-request` events from their sources.

This solution has a small overhead, in that if a provider is not within the DOM hierarchy of the unsatisfied requests we are unnecessarily refiring these requests, but this approach is safest and most correct in that it is very hard to manage unstable DOM hierarchies with the semantics of slotting and reparenting that is common in web components implementations.

Note that ContextRoot uses [WeakRefs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef) which are not supported in IE11.

# Sponsors

We are very grateful to our sponsors without which this works would not have been possible:

[![twiinIT](https://twiinit.com/images/twiinIT_logo_left_no_subtitle.svg)](https://twiinit.com)
