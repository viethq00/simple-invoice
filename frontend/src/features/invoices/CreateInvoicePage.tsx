import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/controls';
import { Alert, Spinner } from '@/components/ui/feedback';
import { Field } from '@/components/ui/Field';
import { isApiError } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import type { InvoiceLinkState } from './components/InvoiceResults';
import {
  createInvoiceDefaults,
  createInvoiceSchema,
  toCreateInvoiceRequest,
  type CreateInvoiceFormValues,
} from './create-invoice-schema';
import { CURRENCIES } from './currencies';
import { useCreateInvoice } from './invoice-api';
import { mapServerErrors } from './server-errors';

export const DUPLICATE_NUMBER_MESSAGE =
  'An invoice with this number already exists. Use a different number.';

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Cancel goes back to the list as it was left.
  const listSearch = (location.state as InvoiceLinkState | null)?.listSearch ?? '';
  const createInvoice = useCreateInvoice();
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: createInvoiceDefaults(),
  });

  const showServerErrors = (error: unknown) => {
    if (isApiError(error) && error.status === 409) {
      setError(
        'invoiceNumber',
        { type: 'server', message: DUPLICATE_NUMBER_MESSAGE },
        { shouldFocus: true },
      );
      return;
    }
    if (isApiError(error) && error.status === 400) {
      const { fields, general } = mapServerErrors(error.messages);
      Object.entries(fields).forEach(([field, message], index) =>
        setError(
          field as keyof typeof fields,
          { type: 'server', message },
          { shouldFocus: index === 0 },
        ),
      );
      setFormErrors(general);
      return;
    }
    // A 401 ends the session globally and the route guard takes over.
    if (isApiError(error) && error.status === 401) return;
    setFormErrors([describeError(error)]);
  };

  const onSubmit = handleSubmit((values) => {
    setFormErrors([]);
    createInvoice.mutate(toCreateInvoiceRequest(values), {
      onSuccess: (invoice) => {
        toast.success(`Invoice ${invoice.invoiceNumber} created`);
        void navigate('/invoices');
      },
      onError: showServerErrors,
    });
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New invoice" description="Totals are calculated when you save." />

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="rounded-sheet bg-paper px-5 py-6 shadow-paper sm:px-10 sm:py-8"
      >
        {formErrors.length > 0 && (
          <Alert tone="error" title="The invoice wasn't created" className="mb-6">
            <ul className="list-disc pl-4">
              {formErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        )}

        <FormSection title="Bill to" description="Who the invoice is for.">
          <Field
            id="customer-fullname"
            label="Customer name"
            required
            error={errors.customer?.fullname?.message}
          >
            {(control) => (
              <Input {...control} autoComplete="name" {...register('customer.fullname')} />
            )}
          </Field>
          <Field
            id="customer-email"
            label="Email address"
            required
            error={errors.customer?.email?.message}
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                {...register('customer.email')}
              />
            )}
          </Field>
          <Field
            id="customer-mobile"
            label="Mobile number"
            error={errors.customer?.mobileNumber?.message}
          >
            {(control) => (
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                {...register('customer.mobileNumber')}
              />
            )}
          </Field>
          <Field
            id="customer-address"
            label="Address"
            error={errors.customer?.address?.message}
            className="sm:col-span-2"
          >
            {(control) => (
              <Textarea
                {...control}
                rows={2}
                autoComplete="street-address"
                {...register('customer.address')}
              />
            )}
          </Field>
        </FormSection>

        <FormSection
          title="Invoice details"
          description="Each invoice number can only be used once."
        >
          <Field
            id="invoice-number"
            label="Invoice number"
            required
            hint="For example INV-2026-001"
            error={errors.invoiceNumber?.message}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                spellCheck={false}
                {...register('invoiceNumber')}
              />
            )}
          </Field>
          <Field id="invoice-reference" label="Reference" error={errors.invoiceReference?.message}>
            {(control) => (
              <Input {...control} autoComplete="off" {...register('invoiceReference')} />
            )}
          </Field>
          <Field
            id="invoice-date"
            label="Invoice date"
            required
            error={errors.invoiceDate?.message}
          >
            {(control) => <Input {...control} type="date" {...register('invoiceDate')} />}
          </Field>
          <Field id="due-date" label="Due date" required error={errors.dueDate?.message}>
            {(control) => <Input {...control} type="date" {...register('dueDate')} />}
          </Field>
          <Field id="currency" label="Currency" required error={errors.currency?.message}>
            {(control) => (
              <Select {...control} {...register('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} ({currency.name})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="description"
            label="Description"
            error={errors.description?.message}
            className="sm:col-span-2"
          >
            {(control) => <Textarea {...control} rows={3} {...register('description')} />}
          </Field>
        </FormSection>

        <FormSection title="Line item" description="One item per invoice.">
          <Field
            id="item-name"
            label="Item name"
            required
            error={errors.items?.[0]?.name?.message}
            className="sm:col-span-2"
          >
            {(control) => <Input {...control} autoComplete="off" {...register('items.0.name')} />}
          </Field>
          <Field
            id="item-quantity"
            label="Quantity"
            required
            error={errors.items?.[0]?.quantity?.message}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
                {...register('items.0.quantity')}
              />
            )}
          </Field>
          <Field
            id="item-rate"
            label="Rate"
            required
            hint="Price per unit"
            error={errors.items?.[0]?.rate?.message}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                autoComplete="off"
                className="tabular-nums"
                {...register('items.0.rate')}
              />
            )}
          </Field>
        </FormSection>

        <FormSection title="Tax and discount" description="Applied to the line item's subtotal.">
          <Field
            id="tax-percent"
            label="Tax (%)"
            hint="Leave blank to use 10%"
            error={errors.taxPercent?.message}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                autoComplete="off"
                className="tabular-nums"
                {...register('taxPercent')}
              />
            )}
          </Field>
          <Field
            id="discount"
            label="Discount"
            hint="An amount in the invoice currency"
            error={errors.discount?.message}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                autoComplete="off"
                className="tabular-nums"
                {...register('discount')}
              />
            )}
          </Field>
        </FormSection>

        <div className="mt-1 flex flex-col-reverse gap-3 border-t border-rule pt-6 sm:flex-row sm:justify-end">
          <ButtonLink to={`/invoices${listSearch}`} variant="secondary">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={createInvoice.isPending}>
            {createInvoice.isPending && <Spinner />}
            {createInvoice.isPending ? 'Creating invoice…' : 'Create invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className="grid gap-5 border-b border-rule py-7 first-of-type:pt-0 last-of-type:border-b-0 md:grid-cols-[13rem_1fr] md:gap-10"
    >
      <div>
        <h2 id={id} className="font-display text-lg">
          {title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
