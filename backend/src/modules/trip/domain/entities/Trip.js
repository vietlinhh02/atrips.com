/**
 * Trip Entity
 * Represents a trip with encapsulated business logic
 */
export class Trip {
  // Private fields
  #id;
  #ownerId;
  #title;
  #description;
  #startDate;
  #endDate;
  #travelersCount;
  #budgetTotal;
  #budgetCurrency;
  #status;
  #visibility;
  #coverImageUrl;
  #createdAt;
  #updatedAt;

  constructor({
    id,
    ownerId,
    title,
    description = null,
    startDate,
    endDate,
    travelersCount = 1,
    budgetTotal = null,
    budgetCurrency = 'VND',
    status = 'DRAFT',
    visibility = 'PRIVATE',
    coverImageUrl = null,
    createdAt = null,
    updatedAt = null,
  }) {
    this.#id = id;
    this.#ownerId = ownerId;
    this.#title = title;
    this.#description = description;
    this.#startDate = startDate;
    this.#endDate = endDate;
    this.#travelersCount = travelersCount;
    this.#budgetTotal = budgetTotal;
    this.#budgetCurrency = budgetCurrency;
    this.#status = status;
    this.#visibility = visibility;
    this.#coverImageUrl = coverImageUrl;
    this.#createdAt = createdAt;
    this.#updatedAt = updatedAt;

    this.#validate();
  }

  // Getters
  get id() {
    return this.#id;
  }

  get ownerId() {
    return this.#ownerId;
  }

  get title() {
    return this.#title;
  }

  get description() {
    return this.#description;
  }

  get startDate() {
    return this.#startDate;
  }

  get endDate() {
    return this.#endDate;
  }

  get travelersCount() {
    return this.#travelersCount;
  }

  get budgetTotal() {
    return this.#budgetTotal;
  }

  get budgetCurrency() {
    return this.#budgetCurrency;
  }

  get status() {
    return this.#status;
  }

  get visibility() {
    return this.#visibility;
  }

  get coverImageUrl() {
    return this.#coverImageUrl;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get updatedAt() {
    return this.#updatedAt;
  }

  // Domain validation
  #validate() {
    if (!this.#title || this.#title.trim().length === 0) {
      throw new Error('Trip title is required');
    }

    if (!this.#startDate) {
      throw new Error('Trip start date is required');
    }

    if (!this.#endDate) {
      throw new Error('Trip end date is required');
    }

    const start = new Date(this.#startDate);
    const end = new Date(this.#endDate);

    if (start >= end) {
      throw new Error('Start date must be before end date');
    }

    if (this.#travelersCount < 1) {
      throw new Error('Travelers count must be at least 1');
    }

    if (this.#budgetTotal !== null && this.#budgetTotal < 0) {
      throw new Error('Budget total must be positive');
    }

    const validStatuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];
    if (!validStatuses.includes(this.#status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const validVisibilities = ['PRIVATE', 'SHARED', 'PUBLIC'];
    if (!validVisibilities.includes(this.#visibility)) {
      throw new Error(`Invalid visibility. Must be one of: ${validVisibilities.join(', ')}`);
    }
  }

  // Domain methods
  updateDetails({ title, description, startDate, endDate, travelersCount, budgetTotal, budgetCurrency, coverImageUrl }) {
    if (title !== undefined) this.#title = title;
    if (description !== undefined) this.#description = description;
    if (startDate !== undefined) this.#startDate = startDate;
    if (endDate !== undefined) this.#endDate = endDate;
    if (travelersCount !== undefined) this.#travelersCount = travelersCount;
    if (budgetTotal !== undefined) this.#budgetTotal = budgetTotal;
    if (budgetCurrency !== undefined) this.#budgetCurrency = budgetCurrency;
    if (coverImageUrl !== undefined) this.#coverImageUrl = coverImageUrl;

    this.#updatedAt = new Date();
    this.#validate();
  }

  updateStatus(newStatus) {
    const validTransitions = {
      DRAFT: ['ACTIVE', 'ARCHIVED'],
      ACTIVE: ['COMPLETED', 'ARCHIVED'],
      COMPLETED: ['ARCHIVED'],
      ARCHIVED: [],
    };

    const allowedStatuses = validTransitions[this.#status] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw new Error(`Cannot transition from ${this.#status} to ${newStatus}`);
    }

    this.#status = newStatus;
    this.#updatedAt = new Date();
  }

  archive() {
    this.updateStatus('ARCHIVED');
  }

  publish() {
    if (this.#status === 'DRAFT') {
      this.updateStatus('ACTIVE');
    }
  }

  updateVisibility(visibility) {
    const validVisibilities = ['PRIVATE', 'SHARED', 'PUBLIC'];
    if (!validVisibilities.includes(visibility)) {
      throw new Error(`Invalid visibility. Must be one of: ${validVisibilities.join(', ')}`);
    }
    this.#visibility = visibility;
    this.#updatedAt = new Date();
  }

  // Persistence conversion
  toPersistence() {
    return {
      id: this.#id,
      owner_id: this.#ownerId,
      title: this.#title,
      description: this.#description,
      start_date: this.#startDate,
      end_date: this.#endDate,
      travelers_count: this.#travelersCount,
      budget_total: this.#budgetTotal,
      budget_currency: this.#budgetCurrency,
      status: this.#status,
      visibility: this.#visibility,
      cover_image_url: this.#coverImageUrl,
      created_at: this.#createdAt,
      updated_at: this.#updatedAt,
    };
  }

  toJSON() {
    return {
      id: this.#id,
      ownerId: this.#ownerId,
      title: this.#title,
      description: this.#description,
      startDate: this.#startDate,
      endDate: this.#endDate,
      travelersCount: this.#travelersCount,
      budgetTotal: this.#budgetTotal,
      budgetCurrency: this.#budgetCurrency,
      status: this.#status,
      visibility: this.#visibility,
      coverImageUrl: this.#coverImageUrl,
      createdAt: this.#createdAt,
      updatedAt: this.#updatedAt,
    };
  }

  toSummary() {
    return {
      id: this.#id,
      title: this.#title,
      startDate: this.#startDate,
      endDate: this.#endDate,
      status: this.#status,
      travelersCount: this.#travelersCount,
      coverImageUrl: this.#coverImageUrl,
    };
  }

  // Factory methods
  static fromPersistence(data) {
    return new Trip({
      id: data.id,
      ownerId: data.owner_id,
      title: data.title,
      description: data.description,
      startDate: data.start_date,
      endDate: data.end_date,
      travelersCount: data.travelers_count,
      budgetTotal: data.budget_total,
      budgetCurrency: data.budget_currency,
      status: data.status,
      visibility: data.visibility,
      coverImageUrl: data.cover_image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  }

  static create({ ownerId, title, description, startDate, endDate, travelersCount, budgetTotal, budgetCurrency, coverImageUrl }) {
    return new Trip({
      id: null,
      ownerId,
      title,
      description,
      startDate,
      endDate,
      travelersCount,
      budgetTotal,
      budgetCurrency,
      status: 'DRAFT',
      visibility: 'PRIVATE',
      coverImageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
