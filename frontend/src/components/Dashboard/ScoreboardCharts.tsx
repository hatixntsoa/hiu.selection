import { useMemo } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, Col, Row } from 'react-bootstrap';
import { usePreferences } from '../../context/PreferencesContext';
import { Challenge } from '../../types';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

function getCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function ScoreboardCharts({
  challenges,
  solvedChallenges,
  userScore
}: {
  challenges: Challenge[];
  solvedChallenges: Set<number>;
  userScore: number;
}): JSX.Element {
  const { t, resolvedTheme } = usePreferences();

  const palette = useMemo(
    () => ({
      text: getCssVar('--warm-text', resolvedTheme === 'dark' ? '#c9d1d9' : '#24292f'),
      muted: getCssVar('--warm-muted', resolvedTheme === 'dark' ? '#8b949e' : '#57606a'),
      primary: getCssVar('--warm-primary', resolvedTheme === 'dark' ? '#2f81f7' : '#0969da'),
      success: getCssVar('--warm-success', resolvedTheme === 'dark' ? '#3fb950' : '#1a7f37'),
      info: getCssVar('--warm-info', resolvedTheme === 'dark' ? '#388bfd' : '#1f6feb'),
      warning: getCssVar('--warm-warning', resolvedTheme === 'dark' ? '#d29922' : '#9a6700'),
      danger: getCssVar('--warm-danger', resolvedTheme === 'dark' ? '#f85149' : '#cf222e'),
      border: getCssVar('--warm-border', resolvedTheme === 'dark' ? '#30363d' : '#d0d7de')
    }),
    [resolvedTheme]
  );

  const solvedCount = solvedChallenges.size;
  const totalCount = challenges.length || 1;
  const solvedPoints = challenges
    .filter((c) => solvedChallenges.has(c.id))
    .reduce((sum, c) => sum + Number(c.default_points || 50), 0);
  const totalPoints = challenges.reduce((sum, c) => sum + Number(c.default_points || 50), 0) || 1;

  const categoryMap = challenges.reduce<Record<string, { solved: number; total: number }>>((acc, challenge) => {
    const bucket = 'Flags';
    if (!acc[bucket]) {
      acc[bucket] = { solved: 0, total: 0 };
    }
    acc[bucket].total += 1;
    if (solvedChallenges.has(challenge.id)) {
      acc[bucket].solved += 1;
    }
    return acc;
  }, {});

  const categoryLabels = Object.keys(categoryMap);
  const categorySolvedValues = categoryLabels.map((category) => categoryMap[category].solved);
  const categoryTotalValues = categoryLabels.map((category) => categoryMap[category].total);

  const progressChartData = {
    labels: [t('chartsSolved'), t('chartsRemaining')],
    datasets: [
      {
        data: [solvedCount, Math.max(0, totalCount - solvedCount)],
        backgroundColor: [palette.success, palette.border],
        borderColor: [palette.success, palette.border],
        borderWidth: 1
      }
    ]
  };

  const pointsChartData = {
    labels: [t('chartsScoredPoints'), t('chartsRemainingPoints')],
    datasets: [
      {
        data: [userScore, Math.max(0, totalPoints - userScore)],
        backgroundColor: [palette.primary, palette.border],
        borderColor: [palette.primary, palette.border],
        borderWidth: 1
      }
    ]
  };

  const categoryBarData = {
    labels: categoryLabels,
    datasets: [
      {
        label: t('chartsCategorySolved'),
        data: categorySolvedValues,
        backgroundColor: palette.info
      },
      {
        label: t('chartsCategoryTotal'),
        data: categoryTotalValues,
        backgroundColor: palette.warning
      }
    ]
  };

  const baseLegendLabelColor = palette.text;
  const baseAxisColor = palette.muted;

  return (
    <Row className="g-4 mt-1">
      <Col lg={4}>
        <Card className="soft-card h-100">
          <Card.Header>
            <h6 className="mb-0">{t('chartsSolveProgress')}</h6>
          </Card.Header>
          <Card.Body>
            <Doughnut
              data={progressChartData}
              options={{
                plugins: {
                  legend: {
                    labels: { color: baseLegendLabelColor }
                  }
                }
              }}
            />
            <p className="text-secondary mt-3 mb-0">
              {t('chartsSolvedLevels', { solved: solvedCount, total: totalCount })}
            </p>
          </Card.Body>
        </Card>
      </Col>
      <Col lg={4}>
        <Card className="soft-card h-100">
          <Card.Header>
            <h6 className="mb-0">{t('chartsPointsProgress')}</h6>
          </Card.Header>
          <Card.Body>
            <Doughnut
              data={pointsChartData}
              options={{
                plugins: {
                  legend: {
                    labels: { color: baseLegendLabelColor }
                  }
                }
              }}
            />
            <p className="text-secondary mt-3 mb-0">
              {t('chartsPointsSummary', { solved: solvedPoints, total: totalPoints })}
            </p>
          </Card.Body>
        </Card>
      </Col>
      <Col lg={4}>
        <Card className="soft-card h-100">
          <Card.Header>
            <h6 className="mb-0">{t('chartsCategoryBreakdown')}</h6>
          </Card.Header>
          <Card.Body>
            <Bar
              data={categoryBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: { color: baseLegendLabelColor }
                  }
                },
                scales: {
                  x: {
                    ticks: { color: baseAxisColor },
                    grid: { color: palette.border }
                  },
                  y: {
                    ticks: { color: baseAxisColor, stepSize: 1 },
                    grid: { color: palette.border }
                  }
                }
              }}
              height={220}
            />
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export default ScoreboardCharts;
