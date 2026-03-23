import Image from 'next/image';

export default function PoweredByAIBadge() {
  const poweredAiBase = '/front/powered-ai/base.svg';
  const poweredAiCore = '/front/powered-ai/core.svg';
  const poweredAiDotSmall = '/front/powered-ai/dot-small.svg';
  const poweredAiDotLarge = '/front/powered-ai/dot-large.svg';
  const poweredAiDotMedium = '/front/powered-ai/dot-medium.svg';
  const poweredAiDotAlt = '/front/powered-ai/dot-alt.svg';

  return (
    <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-white px-3 py-2 text-sm text-[var(--neutral-100)]">
      <div className="relative h-[22.208px] w-[19.555px]">
        <Image
          alt=""
          src={poweredAiBase}
          width={20}
          height={22}
          className="absolute left-[0.45px] top-[0.01px] h-[22.208px] w-[19.555px]"
          unoptimized
          priority
        />
        <div className="absolute left-0 top-0 h-[22.208px] w-[19.555px]">
          <Image
            alt=""
            src={poweredAiCore}
            width={20}
            height={22}
            className="absolute inset-[-18.89%_-27.57%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[7.49px] top-[8.01px] h-[6.351px] w-[6.783px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotLarge}
            width={7}
            height={6}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[2.7px] top-[5.76px] h-[10.417px] w-[10.967px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotMedium}
            width={11}
            height={10}
            className="absolute inset-[-47.76%_-45.37%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[6.77px] top-[9.12px] h-[6.884px] w-[7.353px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotSmall}
            width={7}
            height={7}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[3px] top-[3.22px] h-[6.351px] w-[6.783px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotSmall}
            width={7}
            height={6}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[11.48px] top-[7.13px] h-[7.443px] w-[7.949px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotAlt}
            width={8}
            height={7}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[12.16px] top-[3.04px] h-[6.351px] w-[6.783px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotSmall}
            width={7}
            height={6}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[10.9px] top-[14.03px] h-[6.351px] w-[6.783px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotSmall}
            width={7}
            height={6}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
        <div className="absolute left-[5.78px] top-[13.26px] h-[6.351px] w-[6.783px] mix-blend-color-burn">
          <Image
            alt=""
            src={poweredAiDotSmall}
            width={7}
            height={6}
            className="absolute inset-[-43.15%_-40.4%] h-full w-full"
            unoptimized
          />
        </div>
      </div>
      Powered by AI
    </div>
  );
}
