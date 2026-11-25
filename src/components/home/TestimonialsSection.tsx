"use client";

import React from "react";
import Image from "next/image";
import { TESTIMONIALS } from "@/data/testimonials";
import { Star, Quote, Sparkles } from "lucide-react";

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-24 bg-[#EDF5FA] border-t border-[#D5E4EF] text-left">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-serif font-semibold uppercase tracking-[0.2em] text-[#258FE5]">
            <span>Patient Perspectives</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-normal text-[#163B63] tracking-tight">
            Designed for thoughtful, unhurried healthcare.
          </h2>
          <p className="text-base font-serif text-[#526A82] leading-relaxed font-light">
            Reflections from patients who have experienced our digital sanctuary, private telehealth consultations, and coordinated follow-ups.
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DCECF8] border border-[#20B8AD]/30 text-xs font-serif text-[#258FE5]">
            <Sparkles className="w-3.5 h-3.5 text-[#20B8AD]" />
            <span>Sample Patient Narratives from Demonstration Consultations</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((test) => (
            <div
              key={test.id}
              className="rounded-3xl bg-white border border-[#D5E4EF] p-8 shadow-subtle hover:shadow-editorial hover:border-[#258FE5] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1 text-[#20B8AD]">
                    {[...Array(test.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#20B8AD]" />
                    ))}
                  </div>
                  <Quote className="w-8 h-8 text-[#20B8AD]/30" />
                </div>

                <p className="text-sm sm:text-base text-[#163B63] leading-relaxed mb-8 font-serif italic">
                  &ldquo;{test.comment}&rdquo;
                </p>
              </div>

              <div className="pt-5 border-t border-[#D5E4EF] flex items-center gap-3.5">
                <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-[#D5E4EF]">
                  <Image
                    src={test.avatar}
                    alt={test.authorName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-serif font-semibold text-[#163B63]">{test.authorName}</div>
                  <div className="text-xs font-serif text-[#526A82]">
                    {test.role} • {test.location}
                  </div>
                  <div className="text-[11px] font-serif text-[#258FE5] font-medium mt-0.5">
                    For: {test.consultedFor}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
