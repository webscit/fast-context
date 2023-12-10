/**
 * @license
 * Copyright 2023 Frederic Collonval
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {attr, customElement, FASTElement, html, nullableNumberConverter} from '@microsoft/fast-element';

import {ContextProvider, Context, ContextConsumer} from 'fast-context';
import {assert} from '@esm-bundle/chai';

const simpleContext = 'simple-context' as Context<'simple-context', number>;

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
  name: 'multiple-context-consumer',
  template: html`Value <span id="value">${x => x.value}</span>`
})
class MultipleContextConsumer extends FASTElement {
  @attr({converter: nullableNumberConverter})
  public value = 0;

  public constructor() {
    super();
    new ContextConsumer(this, {
      context: simpleContext,
      callback: (value) => {
        this.value = value;
      },
      subscribe: true,
    });
  }
}

@customElement({
  name: 'once-context-consumer',
  template:  html`Value <span id="value">${x => x.value}</span>`
})
class OnceContextConsumer extends FASTElement {
  @attr({converter: nullableNumberConverter})
  public value = 0;

  public constructor() {
    super();
    new ContextConsumer(this, {
      context: simpleContext,
      callback: (value) => {
        this.value = value;
      },
    });
  }
}

suite('context-provider', () => {
  let provider: SimpleContextProvider;
  let consumer: MultipleContextConsumer;

  setup(async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <simple-context-provider>
        <multiple-context-consumer></multiple-context-consumer>
      </simple-context-provider>
    `;
    document.body.appendChild(container);

    provider = container.querySelector(
      'simple-context-provider'
    ) as SimpleContextProvider;
    assert.isDefined(provider);
    consumer = provider.querySelector(
      'multiple-context-consumer'
    ) as MultipleContextConsumer;
    assert.isDefined(consumer);
  });

  test(`consumer receives a context`, async () => {
    assert.strictEqual(consumer.value, 1000);
  });

  test(`consumer receives updated context on provider change`, async () => {
    assert.strictEqual(consumer.value, 1000);
    provider.setValue(500);
    assert.strictEqual(consumer.value, 500);
  });

  test(`multiple consumers receive the same context`, async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <multiple-context-consumer>
      </multiple-context-consumer>
    `;
    provider.appendChild(container);
    const consumer2 = container.querySelector(
      'multiple-context-consumer'
    ) as MultipleContextConsumer;
    assert.isDefined(consumer2);

    assert.strictEqual(consumer.value, 1000);
    assert.strictEqual(consumer2.value, 1000);

    provider.setValue(500);
    assert.strictEqual(consumer.value, 500);
    assert.strictEqual(consumer2.value, 500);
  });
  test(`one-time consumers only receive context once`, async () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <once-context-consumer>
      </once-context-consumer>
    `;
    provider.appendChild(container);
    const consumer2 = container.querySelector(
      'once-context-consumer'
    ) as OnceContextConsumer;
    assert.isDefined(consumer2);

    assert.strictEqual(consumer.value, 1000);
    assert.strictEqual(consumer2.value, 1000);

    provider.setValue(500);
    assert.strictEqual(consumer.value, 500);
    assert.strictEqual(consumer2.value, 1000); // one-time consumer still has old value
  });
});
