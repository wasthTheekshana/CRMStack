import { Request, Response } from 'express';
import { query } from '../config/db';
import { getWonStageNames, findConfigByTenantId, DashboardWidget } from '../models/tenantConfigModel';

export async function getKpis(req: Request, res: Response) {
  const isAdmin  = req.user!.role === 'admin';
  const userId   = req.user!.userId;
  const tenantId = req.user!.tenantId;

  // Tenant is always filtered; additionally scope to owner for sales role
  const ownerClause = isAdmin ? '' : 'AND owner_id = $2';
  const params      = isAdmin ? [tenantId] : [tenantId, userId];

  // Get the tenant's won stage names for accurate active_deals count
  const wonStageNames = await getWonStageNames(tenantId);
  const wonClause     = wonStageNames.length > 0
    ? `AND sales_stage NOT IN (${wonStageNames.map((_, i) => `$${params.length + i + 1}`).join(', ')})`
    : '';
  const summaryParams = [...params, ...wonStageNames];

  try {
    const [summary, byStage, bySolution, topCustomers] = await Promise.all([
      query(
        `SELECT
           COUNT(DISTINCT company_name)                 AS companies,
           COUNT(*)                                      AS total_leads,
           COUNT(*) FILTER (WHERE true ${wonClause})    AS active_deals,
           SUM(estimated_revenue)                        AS total_revenue,
           SUM(estimated_revenue * probability / 100.0) AS weighted_revenue
         FROM leads
         WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}`,
        summaryParams
      ),

      query(
        `SELECT
           sales_stage,
           COUNT(*)               AS count,
           SUM(estimated_revenue) AS revenue
         FROM leads
         WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
         GROUP BY sales_stage
         ORDER BY COUNT(*) DESC`,
        params
      ),

      query(
        `SELECT
           solution,
           COUNT(*)               AS count,
           SUM(estimated_revenue) AS revenue
         FROM leads
         WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
         GROUP BY solution
         ORDER BY revenue DESC`,
        params
      ),

      query(
        `SELECT
           company_name,
           sales_stage,
           estimated_revenue,
           probability,
           owner_email
         FROM leads
         WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
         ORDER BY estimated_revenue DESC
         LIMIT 5`,
        params
      ),
    ]);

    const s = summary.rows[0];
    res.json({
      summary: {
        companies:       parseInt(s.companies),
        totalLeads:      parseInt(s.total_leads),
        activeDeals:     parseInt(s.active_deals),
        totalRevenue:    parseFloat(s.total_revenue)    || 0,
        weightedRevenue: parseFloat(s.weighted_revenue) || 0,
      },
      byStage: byStage.rows.map(r => ({
        stage:   r.sales_stage,
        count:   parseInt(r.count),
        revenue: parseFloat(r.revenue) || 0,
      })),
      bySolution: bySolution.rows.map(r => ({
        solution: r.solution,
        count:    parseInt(r.count),
        revenue:  parseFloat(r.revenue) || 0,
      })),
      topCustomers: topCustomers.rows.map(r => ({
        companyName:      r.company_name,
        salesStage:       r.sales_stage,
        estimatedRevenue: parseFloat(r.estimated_revenue),
        probability:      r.probability,
        ownerEmail:       r.owner_email,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getCustomWidgets(req: Request, res: Response) {
  const isAdmin  = req.user!.role === 'admin';
  const userId   = req.user!.userId;
  const tenantId = req.user!.tenantId;

  try {
    const config = await findConfigByTenantId(tenantId);
    if (!config || config.dashboardWidgets.length === 0) {
      res.json({ widgets: [] });
      return;
    }

    const roleFilter = isAdmin ? 'admin' : 'sales';
    const widgets = config.dashboardWidgets.filter(
      (w: DashboardWidget) => w.role === 'both' || w.role === roleFilter
    );

    const ownerClause = isAdmin ? '' : 'AND owner_id = $2';
    const baseParams  = isAdmin ? [tenantId] : [tenantId, userId];

    const results = [];

    for (const widget of widgets) {
      const fieldParam = widget.field_id;

      if (widget.type === 'group_by' && widget.group_by_field) {
        const groupField = widget.group_by_field;
        const result = await query(
          `SELECT
             custom_fields->>$${baseParams.length + 1} AS group_key,
             SUM((custom_fields->>$${baseParams.length + 2})::numeric) AS total,
             AVG((custom_fields->>$${baseParams.length + 2})::numeric) AS average,
             COUNT(*) AS count
           FROM leads
           WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
             AND custom_fields->>$${baseParams.length + 2} IS NOT NULL
           GROUP BY custom_fields->>$${baseParams.length + 1}
           ORDER BY total DESC`,
          [...baseParams, groupField, fieldParam]
        );
        results.push({
          id:         widget.id,
          name:       widget.name,
          chart_type: widget.chart_type,
          field_id:   widget.field_id,
          data:       result.rows.map((r: any) => ({
            group:   r.group_key ?? 'Unknown',
            total:   parseFloat(r.total) || 0,
            average: parseFloat(r.average) || 0,
            count:   parseInt(r.count),
          })),
        });
      } else {
        // Scalar aggregation (sum, average, count, min, max)
        const aggMap: Record<string, string> = {
          sum:     'SUM',
          average: 'AVG',
          count:   'COUNT',
          min:     'MIN',
          max:     'MAX',
        };
        const aggFunc = aggMap[widget.type] || 'SUM';

        const valueExpr = widget.type === 'count'
          ? 'COUNT(*)'
          : `${aggFunc}((custom_fields->>$${baseParams.length + 1})::numeric)`;

        const result = await query(
          `SELECT ${valueExpr} AS value
           FROM leads
           WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
             ${widget.type !== 'count' ? `AND custom_fields->>$${baseParams.length + 1} IS NOT NULL` : ''}`,
          widget.type === 'count' ? baseParams : [...baseParams, fieldParam]
        );

        results.push({
          id:         widget.id,
          name:       widget.name,
          chart_type: widget.chart_type,
          field_id:   widget.field_id,
          data:       { value: parseFloat(result.rows[0]?.value) || 0 },
        });
      }
    }

    res.json({ widgets: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
