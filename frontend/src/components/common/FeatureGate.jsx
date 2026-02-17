import { useFeatureFlag } from '../../context/FeatureFlagContext';

const FeatureGate = ({ flag, children, fallback = null }) => {
  const enabled = useFeatureFlag(flag);
  return enabled ? children : fallback;
};

export default FeatureGate;
