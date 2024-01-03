/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  DOM,
  FASTElement,
  attr,
  customElement,
  html,
  nullableNumberConverter,
} from '@microsoft/fast-element';

import {createContext, defineConsumer, defineProvider} from 'fast-element-context';
import {assert} from '@esm-bundle/chai';
import {memorySuite} from './test_util.js';

const simpleContext = createContext<number>('simple-context');
const optionalContext = createContext<number | undefined>('optional-context');

@customElement({
  name: 'context-consumer',
  template: html`Value <span id="value">${(x) => x.value}</span>`,
})
class ContextConsumerElement extends FASTElement {
  @attr({converter: nullableNumberConverter})
  public value?: number;

  @attr({converter: nullableNumberConverter})
  public value2?: string;

  @attr({converter: nullableNumberConverter})
  public optionalValue?: number;

  @attr({converter: nullableNumberConverter})
  public consumeOptionalWithDefault: number | undefined = 0;

  constructor() {
    super();
    defineConsumer(this, 'value', {
      context: simpleContext,
      subscribe: true,
    });
    defineConsumer(this, 'value2', {
      context: simpleContext,
      subscribe: true,
    });
    defineConsumer(this, 'optionalValue', {
      context: optionalContext,
      subscribe: true,
    });
    defineConsumer(this, 'consumeOptionalWithDefault', {
      context: optionalContext,
      subscribe: true,
    });
  }
}

@customElement({
  name: 'context-provider',
  template: html`
    <div>
      <slot></slot>
    </div>
  `,
})
class ContextProviderElement extends FASTElement {
  @attr({converter: nullableNumberConverter})
  public value = 0;

  @attr({converter: nullableNumberConverter, mode: 'fromView'})
  public optionalValue?: number;

  constructor() {
    super();
    defineProvider(this, 'value', {context: simpleContext});
    defineProvider(this, 'optionalValue', {context: optionalContext});
  }
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

    DOM.processUpdates();

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
    // The nullableNumberConverter will set the initial value to `null`
    // as the attribute is `undefined`
    assert.strictEqual(consumer.optionalValue, null);
    assert.strictEqual(consumer.consumeOptionalWithDefault, null);
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

memorySuite('memory leak test', () => {
  let consumer: ContextConsumerElement;
  let provider: ContextProviderElement;
  let container: HTMLElement;

  // Make a big array set on an expando to exaggerate any leaked DOM
  const big = () => new Uint8Array(1024 * 10).fill(0);

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

    DOM.processUpdates();

    assert.isDefined(consumer);
  });

  teardown(() => {
    document.body.removeChild(container);
  });

  test('attaching and removing the consumer should not leak', async () => {
    window.gc();
    const heap = performance.memory.usedJSHeapSize;
    for (let i = 0; i < 1000; i++) {
      // Remove the previous consumer & add a new one.
      consumer.remove();
      consumer = document.createElement(
        'context-consumer'
      ) as ContextConsumerElement;
      (consumer as any).heapExpandoProp = big();
      provider.appendChild(consumer);
      DOM.processUpdates();
      // Periodically force a GC to prevent the heap size from expanding
      // too much.
      // If we're leaking memory this is a noop. But if we aren't, this makes
      // it easier for the browser's GC to keep the heap size similar to the
      // actual amount of memory we're using.
      if (i % 30 === 0) {
        window.gc();
      }
    }
    window.gc();
    assert.isAtMost(
      performance.memory.usedJSHeapSize / heap - 1,
      // Allow a 10% margin of heap growth; due to the 10kb expando, an actual
      // DOM leak is orders of magnitude larger.
      0.1,
      'memory leak detected'
    );
  });
});
