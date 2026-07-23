type Props = {
  titleClassName?: string;
};

export default function GoFastWithMeStudioCallout({
  titleClassName = 'text-2xl font-bold text-gray-900',
}: Props) {
  return <h1 className={titleClassName}>GoFastWithMe Studio</h1>;
}
