import { Request, Response } from 'express';
import { query } from '../config/db';
import { getWonStageNames } from '../models/tenantConfigModel';

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
