/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Context, consume, provide} from 'fast-context';
import {assert} from '@esm-bundle/chai';
import {DOM, FASTElement, attr, customElement, html, nullableNumberConverter} from '@microsoft/fast-element';

const simpleContext = 'simple-context' as Context<'simple-context', number>;

@customElement({
  name: 'simple-consumer',
  template: html``
})
class SimpleConsumer extends FASTElement {
  @consume({context: simpleContext, subscribe: true})
  value = -1;
}

test(`@provide on a property, not an accessor`, async () => {

  @customElement({
    name: 'provider-without-accessor',
    template: html`<simple-consumer></simple-consumer>`
  })
  class ProviderWithoutAccessorElement extends FASTElement {
    @provide({context: simpleContext})
    value = 0;
  }

  const provider = document.createElement(
    'provider-without-accessor'
  ) as ProviderWithoutAccessorElement;

  document.body.appendChild(provider);
  // The field's value is written with its initial value.
  assert.equal(provider.value, 0);
  DOM.processUpdates()
  const consumer = provider.shadowRoot?.querySelector(
    'simple-consumer'
  ) as SimpleConsumer;
  // The consumer's value is written with the provider's initial value.
  assert.equal(provider.value, 0);
  assert.equal(consumer.value, 0);

  // Updating the provider also updates the subscribing consumer.
  provider.value = 1;
  DOM.processUpdates()
  assert.equal(provider.value, 1);
  assert.equal(consumer.value, 1);
});

test('@provide before @property', async () => {
  @customElement({name: 'provide-before-property', template: html`
        <span>${x => x.value}</span>
        <simple-consumer></simple-consumer>
      `})
  class ProvideBeforeProperty extends FASTElement {
    @provide({context: simpleContext})
    @attr({converter: nullableNumberConverter})
    value = 0;
  }

  const provider = document.createElement(
    'provide-before-property'
  ) as ProvideBeforeProperty;
  document.body.appendChild(provider);
  // The field's value is written with its initial value.
  assert.equal(provider.value, 0);
  DOM.processUpdates()
  const consumer = provider.shadowRoot?.querySelector(
    'simple-consumer'
  ) as SimpleConsumer;
  // The consumer's value is written with the provider's initial value.
  assert.equal(provider.value, 0);
  assert.equal(consumer.value, 0);

  provider.value = 1;
  DOM.processUpdates()
  // Confirm provider is reactive.
  assert.equal(provider.shadowRoot?.querySelector('span')?.textContent, '1');
  // Updating the provider also updates the subscribing consumer.
  assert.equal(consumer.value, 1);
});

test('@provide after @property', async () => {
  @customElement({name: 'provide-after-property', template: html`
        <span>${x => x.value}</span>
        <simple-consumer></simple-consumer>
      `})
  class ProvideAfterProperty extends FASTElement {
    @attr({converter: nullableNumberConverter})
    @provide({context: simpleContext})
    value = 0;
  }

  const provider = document.createElement(
    'provide-after-property'
  ) as ProvideAfterProperty;
  document.body.appendChild(provider);
  // The field's value is written with its initial value.
  assert.equal(provider.value, 0);
  DOM.processUpdates()
  const consumer = provider.shadowRoot?.querySelector(
    'simple-consumer'
  ) as SimpleConsumer;
  // The consumer's value is written with the provider's initial value.
  assert.equal(provider.value, 0);
  assert.equal(consumer.value, 0);

  provider.value = 1;
  DOM.processUpdates()
  // Confirm provider is reactive.
  assert.equal(provider.shadowRoot?.querySelector('span')?.textContent, '1');
  // Updating the provider also updates the subscribing consumer.
  assert.equal(consumer.value, 1);
});
