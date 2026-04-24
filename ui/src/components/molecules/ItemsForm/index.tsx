import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '../../atoms/Button';
import { Field } from '../../atoms/Field';
import './style.scss';

const itemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

type ItemsFormProps = {
  onSubmit: (payload: ItemFormValues) => void;
};

export function ItemsForm({ onSubmit }: ItemsFormProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, formState } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      title: '',
      description: '',
    },
  });

  return (
    <form
      className="form"
      onSubmit={handleSubmit((values) => {
        onSubmit(values);
        reset();
      })}
    >
      <Field
        label={t('common.title')}
        error={
          formState.errors.title ? t('pages.items.validationTitle') : undefined
        }
      >
        <input
          {...register('title')}
          placeholder={t('pages.items.titlePlaceholder')}
        />
      </Field>
      <Field label={t('common.description')}>
        <textarea
          {...register('description')}
          placeholder={t('pages.items.descriptionPlaceholder')}
        />
      </Field>
      <Button type="submit">{t('common.save')}</Button>
    </form>
  );
}
