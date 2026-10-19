"""One visual style for every presentation figure.

Colours come from the reference data-visualisation palette (categorical slots
1-5 in their fixed order, validated for adjacent-series use such as lines and
bars). Each category keeps the same colour in every figure; colour follows the
category, never its rank. Text is always ink, never a series colour.
"""

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

from ml import categories  # noqa: E402

CATEGORY_COLORS = {
    "cs.CV": "#2a78d6",  # slot 1 blue
    "cs.CL": "#eb6834",  # slot 2 orange
    "cs.CR": "#1baf7a",  # slot 3 aqua
    "cs.RO": "#eda100",  # slot 4 yellow
    "cs.DB": "#e87ba4",  # slot 5 magenta
}
CATEGORY_NAMES = categories.CATEGORY_NAMES
# For charts that are not about categories (for example several keywords in one panel):
# the first three slots, which stay distinguishable even when every pair is compared.
SERIES = ["#2a78d6", "#eb6834", "#1baf7a"]

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK_SECONDARY = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"


def apply():
    plt.rcParams.update({
        "font.family": ["Segoe UI", "DejaVu Sans", "sans-serif"],
        "font.size": 12,
        "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "axes.edgecolor": AXIS,
        "axes.linewidth": 0.8,
        "axes.labelcolor": INK_SECONDARY,
        "axes.titlesize": 15,
        "axes.titleweight": "semibold",
        "axes.titlelocation": "left",
        "axes.titlecolor": INK,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "axes.grid.axis": "y",
        "axes.axisbelow": True,
        "grid.color": GRID,
        "grid.linewidth": 0.8,
        "grid.linestyle": "-",
        "xtick.color": MUTED,
        "ytick.color": MUTED,
        "xtick.labelcolor": INK_SECONDARY,
        "ytick.labelcolor": INK_SECONDARY,
        "lines.linewidth": 2.2,
        "lines.solid_capstyle": "round",
        "lines.solid_joinstyle": "round",
        "legend.frameon": False,
        "legend.labelcolor": INK_SECONDARY,
        "text.color": INK,
    })


def end_marker(ax, x, y, color):
    """An end-dot with a surface-coloured ring, so it stays legible where lines cross."""
    ax.plot([x], [y], marker="o", markersize=7, color=color, markeredgecolor=SURFACE, markeredgewidth=2, zorder=5)


def end_labels(ax, items, x, min_gap=0.035):
    """Value labels at the line ends, merged rather than stacked when they would collide.

    items: (y, text, category) per line. Labels closer than min_gap of the y-range become one
    label naming the categories, so no label is ever detached from its line.
    """
    low, high = ax.get_ylim()
    clusters = []
    for y, text, category in sorted(items):
        if clusters and (y - clusters[-1][-1][0]) / (high - low) < min_gap:
            clusters[-1].append((y, text, category))
        else:
            clusters.append([(y, text, category)])
    for cluster in clusters:
        texts = list(dict.fromkeys(t for _, t, _ in cluster))
        label = " / ".join(texts)
        if len(cluster) > 1:
            label += f"  ({', '.join(c for _, _, c in cluster)})"
        y = sum(item[0] for item in cluster) / len(cluster)
        ax.annotate(label, (x, y), xytext=(8, 0), textcoords="offset points", va="center",
                    color=INK_SECONDARY, fontsize=10)


def compact_number(value, _pos=None):
    value = float(value)
    if abs(value) >= 1000:
        text = f"{value / 1000:.1f}".rstrip("0").rstrip(".")
        return f"{text}K"
    return f"{value:.0f}"


COMPACT = FuncFormatter(compact_number)
PERCENT = FuncFormatter(lambda v, _pos=None: f"{v:.0%}" if v >= 0.1 or v == 0 else f"{v:.1%}")


def subtitle(ax, text):
    ax.text(0, 1.02, text, transform=ax.transAxes, color=INK_SECONDARY, fontsize=11, va="bottom")


def source_note(fig, text):
    # Below everything else on the figure; bbox_inches="tight" in save() extends the canvas to include it.
    fig.text(0.01, -0.01, text, color=MUTED, fontsize=9, ha="left", va="top")


def save(fig, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
