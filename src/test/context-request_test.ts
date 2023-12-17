/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  html,
  FASTElement,
  customElement,
  attr,
  nullableNumberConverter,
  DOM,
} from '@microsoft/fast-element';

import {
  ContextConsumer,
  ContextProvider,
  Context,
  createContext,
  defineConsumer,
} from 'fast-context';
import {assert} from '@esm-bundle/chai';

const simpleContext = createContext<number>('simple-context');

@customElement('simple-context-provider')
class SimpleContextProvider extends FASTElement {
  private provider = new ContextProvider(this, {
    context: simpleContext,
    initialValue: 1000,
  });

  public setValue(value: number) {
    this.provider.setValue(value);
  }
}

@customElement({
  name: 'simple-context-consumer',
  template: html`${(x) => x.controllerContext.value}`,
})
class SimpleContextConsumer extends FASTElement {
  @attr({converter: nullableNumberConverter})
  public onceValue = 0;

  @attr({converter: nullableNumberConverter})
  public subscribedValue = 0;

  // just use the controller directly
  public controllerContext = new ContextConsumer(this, {
    context: simpleContext,
    callback: undefined,
    subscribe: true,
  });

  constructor() {
    super();
    // a one-time property fulfilled by context
    defineConsumer(this, 'onceValue', {context: simpleContext})
    // a subscribed property fulfilled by context
    defineConsumer(this, 'subscribedValue', {context: simpleContext, subscribe: true})
  }

  public render() {
    return;
  }
}

suite('context-provider', () => {
  let provider: SimpleContextProvider;
  let consumer: SimpleContextConsumer;

  setup(async () => {
    const container = document.createElement('div');
    container.innerHTML = `
       <simple-context-provider>
         <simple-context-consumer></simple-context-consumer>
       </simple-context-provider>
     `;
    document.body.appendChild(container);

    provider = container.querySelector(
      'simple-context-provider'
    ) as SimpleContextProvider;
    assert.isDefined(provider);
    consumer = provider.querySelector(
      'simple-context-consumer'
    ) as SimpleContextConsumer;
    assert.isDefined(consumer);
  });

  test(`consumer receives a context`, async () => {
    assert.strictEqual(consumer.onceValue, 1000);
    assert.strictEqual(consumer.subscribedValue, 1000);
    assert.strictEqual(consumer.controllerContext.value, 1000);
    DOM.processUpdates();
    assert.equal(consumer.shadowRoot!.innerHTML.replaceAll(/<!--.*?-->/g, ''), '1000');
  });

  test(`consumer receives updated context on provider change`, async () => {
    assert.strictEqual(consumer.onceValue, 1000);
    assert.strictEqual(consumer.subscribedValue, 1000);
    assert.strictEqual(consumer.controllerContext.value, 1000);
    DOM.processUpdates();
    assert.equal(consumer.shadowRoot!.innerHTML.replaceAll(/<!--.*?-->/g, ''), '1000');
    provider.setValue(500);
    assert.strictEqual(consumer.onceValue, 1000); // once value shouldn't change
    assert.strictEqual(consumer.subscribedValue, 500);
    assert.strictEqual(consumer.controllerContext.value, 500);
    DOM.processUpdates();
    assert.equal(consumer.shadowRoot!.innerHTML.replaceAll(/<!--.*?-->/g, ''), '500');
  });
});

suite('htmlelement-context-provider', () => {
  let provider: ContextProvider<Context<unknown, number>, HTMLElement>;
  let consumer: SimpleContextConsumer;

  setup(async () => {
    const container = document.createElement('div');
    container.innerHTML = `
       <simple-context-consumer></simple-context-consumer>
     `;

    provider = new ContextProvider(container, {
      context: simpleContext,
      initialValue: 1000,
    });

    document.body.appendChild(container);
    provider.hostConnected();

    consumer = container.querySelector(
      'simple-context-consumer'
    ) as SimpleContextConsumer;
    assert.isDefined(consumer);
  });

  test(`consumer receives a context`, async () => {
    assert.strictEqual(consumer.onceValue, 1000);
    assert.strictEqual(consumer.subscribedValue, 1000);
    assert.strictEqual(consumer.controllerContext.value, 1000);
    DOM.processUpdates();
    assert.equal(consumer.shadowRoot!.innerHTML, '1000');
  });

  test(`consumer receives updated context on provider change`, async () => {
    assert.strictEqual(consumer.onceValue, 1000);
    assert.strictEqual(consumer.subscribedValue, 1000);
    assert.strictEqual(consumer.controllerContext.value, 1000);
    DOM.processUpdates();
    assert.equal(consumer.shadowRoot!.innerHTML, '1000');
    provider.setValue(500);
    assert.strictEqual(consumer.onceValue, 1000); // once value shouldn't change
    assert.strictEqual(consumer.subscribedValue, 500);
    assert.strictEqual(consumer.controllerContext.value, 500);
    DOM.processUpdates();
    assert.equal(consumer.shadowRoot!.innerHTML, '500');
  });
});
