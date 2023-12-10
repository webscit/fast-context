/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {DOM, FASTElement, html, nullableNumberConverter} from '@microsoft/fast-element';
import {createContext, consume, provide} from 'fast-context';
import {assert} from '@esm-bundle/chai';

const simpleContext = createContext<number>('simple-context');
const optionalContext = createContext<number | undefined>('optional-context');

class ContextConsumerElement extends FASTElement {
  static definition = {
    name: 'context-consumer', 
    template: html`Value <span id="value">${x => x.value}</span>`,
    attributes: [
      { property: 'value', converter: nullableNumberConverter, mode: 'fromView'},
      { property: 'value2', converter: nullableNumberConverter, mode: 'fromView'},
      { property: 'optionalValue', converter: nullableNumberConverter, mode: 'fromView'},
      { property: 'consumeOptionalWithDefault', converter: nullableNumberConverter, mode: 'fromView'},
    ]
  }
  @consume({context: simpleContext, subscribe: true})
  // TODO: should this include `| undefined`?
  public accessor value: number = undefined as unknown as number;

  // @ts-expect-error Type 'string | undefined' is not assignable to type 'number'.
  @consume({context: simpleContext, subscribe: true})
  public accessor value2: string | undefined;

  @consume({context: optionalContext, subscribe: true})
  public accessor optionalValue: number | undefined;

  @consume({context: optionalContext, subscribe: true})
  public accessor consumeOptionalWithDefault: number | undefined = 0;

}

FASTElement.define(ContextConsumerElement)

class ContextProviderElement extends FASTElement {
  static definition = {
    name: 'context-provider',
    template: html`
      <div>
        <slot></slot>
      </div>
    `,
    attributes: [
      {property: 'value', converter: nullableNumberConverter, mode: 'fromView'},
      {property: 'optionalValue', converter: nullableNumberConverter}
    ]
  }

  @provide({context: simpleContext})
  public accessor value = 0;

  @provide({context: optionalContext})
  public accessor optionalValue: number | undefined;
}

suite('@consume', () => {
  let consumer: ContextConsumerElement;
  let provider: ContextProviderElement;
  let container: HTMLElement;
  setup(async () => {
    container = document.createElement('div');
    container.innerHTML = `
        <context-provider value="1000">
            <context-consumer></context-consumer>
        </context-provider>
    `;
    document.body.appendChild(container);

    provider = container.querySelector(
      'context-provider'
    ) as ContextProviderElement;

    consumer = container.querySelector(
      'context-consumer'
    ) as ContextConsumerElement;

    DOM.processUpdates()

    assert.isDefined(consumer);
  });

  teardown(() => {
    document.body.removeChild(container);
  });

  test(`consumer receives a context`, async () => {
    assert.strictEqual(consumer.value, 1000);
  });

  test(`consumer receives updated context on provider change`, async () => {
    assert.strictEqual(consumer.value, 1000);
    provider.value = 500;
    DOM.processUpdates();
    assert.strictEqual(consumer.value, 500);
  });

  test('consuming and providing with optional fields', async () => {
    assert.strictEqual(consumer.optionalValue, undefined);
    assert.strictEqual(consumer.consumeOptionalWithDefault, undefined);
    provider.optionalValue = 500;
    assert.strictEqual(consumer.optionalValue, 500);
    assert.strictEqual(consumer.consumeOptionalWithDefault, 500);
  });
});

suite('@consume: multiple instances', () => {
  let consumers: ContextConsumerElement[];
  let providers: ContextProviderElement[];
  let container: HTMLElement;
  const count = 3;
  setup(async () => {
    container = document.createElement('div');
    container.innerHTML = Array.from(
      {length: count},
      (_v, i) => `
        <context-provider value="${1000 + i}">
            <context-consumer></context-consumer>
        </context-provider>`
    ).join('/n');
    document.body.appendChild(container);

    providers = Array.from(
      container.querySelectorAll<ContextProviderElement>('context-provider')
    );

    consumers = Array.from(
      container.querySelectorAll<ContextConsumerElement>('context-consumer')
    );

    DOM.processUpdates();
  });

  teardown(() => {
    document.body.removeChild(container);
  });

  test(`consumers receive context`, async () => {
    consumers.forEach((consumer, i) =>
      assert.strictEqual(consumer.value, 1000 + i)
    );
  });

  test(`consumers receive updated context on provider change`, async () => {
    consumers.forEach((consumer, i) =>
      assert.strictEqual(consumer.value, 1000 + i)
    );
    providers.forEach((provider, i) => (provider.value = 500 + i));
    DOM.processUpdates();
    consumers.forEach((consumer, i) =>
      assert.strictEqual(consumer.value, 500 + i)
    );
  });
});
