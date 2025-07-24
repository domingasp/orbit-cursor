import { ContentRotate } from "../../../components/content-rotate/content-rotate";

type NumberRotateProps = {
  children: string;
};

export const NumberRotate = ({ children }: NumberRotateProps) => {
  const values = children.split("");

  return values.map((v, i) => (
    <ContentRotate key={i} contentKey={v}>
      {v}
    </ContentRotate>
  ));
};
